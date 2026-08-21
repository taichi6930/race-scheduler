/**
 * rateLimitMiddleware / shouldRateLimit のデシジョンテーブル（SEC-011, SEC-013）
 *
 * | #    | 対象                | 条件                                                   | 期待                                        |
 * | ---- | -------------------- | -------------------------------------------------------- | --------------------------------------------- |
 * | T-01 | rateLimitMiddleware   | RATE_LIMITER バインディング無し（GETリクエスト）        | limit()を呼ばずに200（next()が呼ばれる）     |
 * | T-02 | rateLimitMiddleware   | 対象外ルート（サービス認証で保護済み）                  | limit()を呼ばずに200                         |
 * | T-03 | rateLimitMiddleware   | 対象ルート・limit()がsuccess:true                        | 200（next()が呼ばれる）                      |
 * | T-04 | rateLimitMiddleware   | 対象ルート・limit()がsuccess:false                       | 429・Retry-Afterヘッダ付与、next()は呼ばれない（QERR-04） |
 * | T-05 | rateLimitMiddleware   | CF-Connecting-IPヘッダ有り                                | limit()にそのIPをkeyとして渡す               |
 * | T-06 | rateLimitMiddleware   | CF-Connecting-IPヘッダ無し                                | limit()に'unknown'をkeyとして渡す            |
 * | T-07 | shouldRateLimit       | reason='cors-preflight'のルート                           | false（対象外）                              |
 * | T-08 | shouldRateLimit       | reason='monitoring'のルート                               | false（対象外）                              |
 * | T-09 | shouldRateLimit       | reason='has-own-auth'のルート                             | false（対象外）                              |
 * | T-10 | shouldRateLimit       | reason='front-public'のルート                             | true（対象）                                 |
 * | T-11 | shouldRateLimit       | サービス認証免除ルート一覧に無いルート                    | false（サービス認証で保護済みのため対象外） |
 * | T-12 | rateLimitMiddleware   | 書き込み系（POST）・対象ルート・両バインディング有り     | RATE_LIMITER_WRITEのlimit()が呼ばれる（RATE_LIMITERは呼ばれない） |
 * | T-13 | rateLimitMiddleware   | 読み取り系（GET）・対象ルート・両バインディング有り       | RATE_LIMITERのlimit()が呼ばれる（RATE_LIMITER_WRITEは呼ばれない） |
 * | T-14 | rateLimitMiddleware   | 書き込み系（POST）・RATE_LIMITER_WRITEバインディング無し | limit()を呼ばずに200（書き込み用バインディング未設定時はフェイルオープン） |
 * | T-15 | rateLimitMiddleware   | RATE_LIMITERバインディング無し（GET）を2回リクエスト     | appLogger.errorは1回だけ呼ばれる（CFSEC-02） |
 * | T-16 | rateLimitMiddleware   | RATE_LIMITER_WRITEバインディング無し（POST）             | appLogger.errorがバインディング名付きで呼ばれる（CFSEC-02） |
 */

import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { Hono } from 'hono';

import {
    rateLimitMiddleware,
    resetRateLimitLoggingStateForTesting,
    shouldRateLimit,
} from '../../../src/http/rateLimitMiddleware';
import type { ServiceAuthExemptRoute } from '../../../src/http/serviceAuth';
import { appLogger } from '../../../src/utilities/appLogger';

const EXEMPT_ROUTES: readonly ServiceAuthExemptRoute[] = [
    { method: 'OPTIONS', path: '*', reason: 'cors-preflight' },
    { method: 'GET', path: '/health', reason: 'monitoring' },
    { method: 'GET', path: '/place', reason: 'front-public' },
    { method: 'POST', path: '/push/dispatch', reason: 'has-own-auth' },
    {
        method: 'POST',
        path: '/push/subscription',
        reason: 'user-auth-required',
    },
];

interface MockEnv {
    RATE_LIMITER?: { limit: ReturnType<typeof mock> };
    RATE_LIMITER_WRITE?: { limit: ReturnType<typeof mock> };
}

const buildApp = (): Hono => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware(EXEMPT_ROUTES));
    app.get('/place', (c) => c.json({ status: 'ok' }));
    app.get('/health', (c) => c.json({ status: 'ok' }));
    app.post('/protected', (c) => c.json({ status: 'ok' }));
    app.post('/push/subscription', (c) => c.json({ status: 'ok' }));
    return app;
};

const request = async (
    app: Hono,
    path: string,
    env: MockEnv,
    init?: RequestInit,
): Promise<Response> =>
    app.fetch(new Request(`http://localhost${path}`, init), env);

describe('shouldRateLimit', () => {
    it('[T-07] cors-preflightのルートはfalseを返す', () => {
        expect(shouldRateLimit('OPTIONS', '/place', EXEMPT_ROUTES)).toBe(false);
    });

    it('[T-08] monitoringのルートはfalseを返す', () => {
        expect(shouldRateLimit('GET', '/health', EXEMPT_ROUTES)).toBe(false);
    });

    it('[T-09] has-own-authのルートはfalseを返す', () => {
        expect(shouldRateLimit('POST', '/push/dispatch', EXEMPT_ROUTES)).toBe(
            false,
        );
    });

    it('[T-10] front-publicのルートはtrueを返す', () => {
        expect(shouldRateLimit('GET', '/place', EXEMPT_ROUTES)).toBe(true);
    });

    it('[T-11] 免除ルート一覧に無いルートはfalseを返す（サービス認証で保護済み）', () => {
        expect(shouldRateLimit('POST', '/protected', EXEMPT_ROUTES)).toBe(
            false,
        );
    });
});

describe('rateLimitMiddleware', () => {
    // bun testは全テストファイルを単一プロセス内で実行しモジュールを共有するため、
    // 他のテストファイル（router テスト等）が先にバインディング未設定のまま
    // ミドルウェアを通していると、loggedMissingBindingFor（初回ログ済みの記憶）が
    // 既に埋まった状態でこのファイルの実行が始まりうる。「初回のみログ」という
    // 振る舞いをテストごとに独立して検証できるよう、CFSEC-02専用のリセットを行う。
    beforeEach(() => {
        resetRateLimitLoggingStateForTesting();
    });

    it('[T-15] RATE_LIMITERバインディング無し_同一バインディングへの2回目のリクエストではログを出さない', async () => {
        const errorSpy = spyOn(appLogger, 'error').mockImplementation(() => {});
        const app = buildApp();

        await request(app, '/place', {});
        await request(app, '/place', {});

        expect(errorSpy).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });

    it('[T-16] RATE_LIMITER_WRITEバインディング無し_バインディング名を含めてログを出す', async () => {
        const errorSpy = spyOn(appLogger, 'error').mockImplementation(() => {});
        const app = buildApp();

        await request(app, '/push/subscription', {}, { method: 'POST' });

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0]?.[0]).toContain('RATE_LIMITER_WRITE');
        errorSpy.mockRestore();
    });

    it('[T-01] RATE_LIMITERバインディング無し_limitを呼ばずに200を返す', async () => {
        const app = buildApp();

        const res = await request(app, '/place', {});

        expect(res.status).toBe(200);
    });

    it('[T-02] 対象外ルート（サービス認証で保護済み）_limitを呼ばずに200を返す', async () => {
        const limit = mock(() => Promise.resolve({ success: true }));
        const app = buildApp();

        // 書き込み系（POST）が使う RATE_LIMITER_WRITE も設定し、バインディング
        // 未設定（フェイルオープン）ではなく shouldRateLimit の対象外判定
        // そのものによってスキップされることを検証する。
        const res = await request(
            app,
            '/protected',
            {
                RATE_LIMITER: { limit },
                RATE_LIMITER_WRITE: { limit },
            },
            { method: 'POST' },
        );

        expect(res.status).toBe(200);
        expect(limit).not.toHaveBeenCalled();
    });

    it('[T-03] 対象ルート_limitがsuccess:trueなら200を返す', async () => {
        const limit = mock(() => Promise.resolve({ success: true }));
        const app = buildApp();

        const res = await request(app, '/place', { RATE_LIMITER: { limit } });

        expect(res.status).toBe(200);
        expect(limit).toHaveBeenCalledTimes(1);
    });

    it('[T-04] 対象ルート_limitがsuccess:falseなら429とRetry-Afterヘッダを返す', async () => {
        const limit = mock(() => Promise.resolve({ success: false }));
        const app = buildApp();

        const res = await request(app, '/place', { RATE_LIMITER: { limit } });

        expect(res.status).toBe(429);
        expect(res.headers.get('Retry-After')).toBe('60');
        const body = (await res.json()) as {
            status: number;
            message: string;
            code: string;
        };
        expect(body.status).toBe(429);
        // QAPI-08: 機械可読なエラーコード
        expect(body.code).toBe('TOO_MANY_REQUESTS');
    });

    it('[T-05] CF-Connecting-IPヘッダ有り_limitにそのIPをkeyとして渡す', async () => {
        const limit = mock(() => Promise.resolve({ success: true }));
        const app = buildApp();

        await request(
            app,
            '/place',
            { RATE_LIMITER: { limit } },
            { headers: { 'CF-Connecting-IP': '203.0.113.1' } },
        );

        expect(limit).toHaveBeenCalledWith({ key: '203.0.113.1' });
    });

    it('[T-06] CF-Connecting-IPヘッダ無し_limitに"unknown"をkeyとして渡す', async () => {
        const limit = mock(() => Promise.resolve({ success: true }));
        const app = buildApp();

        await request(app, '/place', { RATE_LIMITER: { limit } });

        expect(limit).toHaveBeenCalledWith({ key: 'unknown' });
    });

    it('[T-12] 書き込み系（POST）対象ルート_RATE_LIMITER_WRITEのlimitが呼ばれRATE_LIMITERは呼ばれない', async () => {
        const readLimit = mock(() => Promise.resolve({ success: true }));
        const writeLimit = mock(() => Promise.resolve({ success: true }));
        const app = buildApp();

        const res = await request(
            app,
            '/push/subscription',
            {
                RATE_LIMITER: { limit: readLimit },
                RATE_LIMITER_WRITE: { limit: writeLimit },
            },
            { method: 'POST' },
        );

        expect(res.status).toBe(200);
        expect(writeLimit).toHaveBeenCalledTimes(1);
        expect(readLimit).not.toHaveBeenCalled();
    });

    it('[T-13] 読み取り系（GET）対象ルート_RATE_LIMITERのlimitが呼ばれRATE_LIMITER_WRITEは呼ばれない', async () => {
        const readLimit = mock(() => Promise.resolve({ success: true }));
        const writeLimit = mock(() => Promise.resolve({ success: true }));
        const app = buildApp();

        const res = await request(app, '/place', {
            RATE_LIMITER: { limit: readLimit },
            RATE_LIMITER_WRITE: { limit: writeLimit },
        });

        expect(res.status).toBe(200);
        expect(readLimit).toHaveBeenCalledTimes(1);
        expect(writeLimit).not.toHaveBeenCalled();
    });

    it('[T-14] 書き込み系（POST）_RATE_LIMITER_WRITEバインディング無しならlimitを呼ばずに200', async () => {
        const readLimit = mock(() => Promise.resolve({ success: true }));
        const app = buildApp();

        const res = await request(
            app,
            '/push/subscription',
            { RATE_LIMITER: { limit: readLimit } },
            { method: 'POST' },
        );

        expect(res.status).toBe(200);
        expect(readLimit).not.toHaveBeenCalled();
    });
});
