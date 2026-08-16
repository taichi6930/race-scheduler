/**
 * requireServiceAuth のデシジョンテーブル（SECAUTH-03）
 *
 * @spec SPEC-API-001
 *
 * | #    | ルート区分       | トークン             | 期待                                    |
 * | ---- | ------------------ | ---------------------- | ----------------------------------------- |
 * | T-01 | 免除ルート          | なし                    | 200（next() が呼ばれる）                  |
 * | T-02 | 保護ルート          | 正トークン              | 200（next() が呼ばれる）                  |
 * | T-03 | 保護ルート          | 誤トークン              | 401、next() は呼ばれない                  |
 * | T-04 | 保護ルート          | トークン無し            | 401                                       |
 * | T-05 | 保護ルート          | （期待値未設定）        | 401                                       |
 * | T-06 | 保護ルート（誤）    | —                       | 401応答の本文に理由が含まれない            |
 * | T-07 | 保護ルート（誤）    | —                       | ログにトークン値が含まれない               |
 * | T-08 | 保護ルート          | 正トークン              | isInternalServiceCall() が true になる    |
 * | T-09 | 免除ルート          | なし                    | isInternalServiceCall() が false のまま   |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Hono } from 'hono';
import { SERVICE_AUTH_HEADER } from '../../../src/http/serviceAuth';
import { requireServiceAuth } from '../../../src/http/serviceAuthMiddleware';
import { appLogger } from '../../../src/utilities/appLogger';
import { isInternalServiceCall } from '../../../src/utilities/requestContext';

const EXEMPT_ROUTES = [
    { method: 'GET', path: '/health', reason: 'monitoring' as const },
];

const buildApp = (): Hono => {
    const app = new Hono();
    app.use('*', requireServiceAuth(EXEMPT_ROUTES));
    app.get('/health', (c) => c.json({ isInternal: isInternalServiceCall() }));
    app.post('/protected', (c) =>
        c.json({ isInternal: isInternalServiceCall() }),
    );
    return app;
};

describe('requireServiceAuth', () => {
    const originalToken = process.env.SERVICE_AUTH_TOKEN;

    beforeEach(() => {
        process.env.SERVICE_AUTH_TOKEN = 'expected-token';
    });

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.SERVICE_AUTH_TOKEN;
        } else {
            process.env.SERVICE_AUTH_TOKEN = originalToken;
        }
    });

    it('[T-01] 免除ルート_トークン無しでも200を返す', async () => {
        const app = buildApp();

        const res = await app.request('/health');

        expect(res.status).toBe(200);
    });

    it('[T-02] 保護ルート_正トークンで200を返す', async () => {
        const app = buildApp();

        const res = await app.request('/protected', {
            method: 'POST',
            headers: { [SERVICE_AUTH_HEADER]: 'expected-token' },
        });

        expect(res.status).toBe(200);
    });

    it('[T-03] 保護ルート_誤トークンで401を返す', async () => {
        const app = buildApp();

        const res = await app.request('/protected', {
            method: 'POST',
            headers: { [SERVICE_AUTH_HEADER]: 'wrong-token' },
        });

        expect(res.status).toBe(401);
    });

    it('[T-04] 保護ルート_トークン無しで401を返す', async () => {
        const app = buildApp();

        const res = await app.request('/protected', { method: 'POST' });

        expect(res.status).toBe(401);
    });

    it('[T-05] 期待値未設定_401を返す（フェイルクローズ）', async () => {
        delete process.env.SERVICE_AUTH_TOKEN;
        const app = buildApp();

        const res = await app.request('/protected', {
            method: 'POST',
            headers: { [SERVICE_AUTH_HEADER]: 'anything' },
        });

        expect(res.status).toBe(401);
    });

    it('[T-06] 誤トークン_401応答の本文に理由が含まれない', async () => {
        const app = buildApp();

        const res = await app.request('/protected', {
            method: 'POST',
            headers: { [SERVICE_AUTH_HEADER]: 'wrong-token' },
        });
        const body = await res.json();

        expect(body).toEqual({
            status: 401,
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
        });
    });

    it('[T-07] 誤トークン_ログにトークン値が含まれない', async () => {
        const warnSpy = spyOn(appLogger, 'warn');
        const app = buildApp();

        await app.request('/protected', {
            method: 'POST',
            headers: { [SERVICE_AUTH_HEADER]: 'super-secret-value' },
        });

        expect(warnSpy).toHaveBeenCalled();
        const loggedArgs = JSON.stringify(warnSpy.mock.calls);
        expect(loggedArgs).not.toContain('super-secret-value');
        warnSpy.mockRestore();
    });

    it('[T-08] 保護ルート_正トークン_isInternalServiceCallがtrueになること', async () => {
        const app = buildApp();

        const res = await app.request('/protected', {
            method: 'POST',
            headers: { [SERVICE_AUTH_HEADER]: 'expected-token' },
        });
        const body = await res.json();

        expect(body).toEqual({ isInternal: true });
    });

    it('[T-09] 免除ルート_isInternalServiceCallがfalseのままであること', async () => {
        const app = buildApp();

        const res = await app.request('/health');
        const body = await res.json();

        expect(body).toEqual({ isInternal: false });
    });
});
