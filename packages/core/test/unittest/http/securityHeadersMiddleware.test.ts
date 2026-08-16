/**
 * securityHeadersMiddleware のデシジョンテーブル（SEC-031）
 *
 * | #    | 条件                              | 期待                                                        |
 * | ---- | ----------------------------------- | ------------------------------------------------------------- |
 * | T-01 | 通常のレスポンス                  | Content-Security-Policy/X-Content-Type-Options/Referrer-Policy が付与される |
 * | T-02 | c.json() で組み立てたレスポンス   | 同上（Hono標準のレスポンス生成でも付与される）                |
 * | T-03 | 複数回リクエストしても             | 毎回同じヘッダー値が付与される                                |
 * | T-04 | cspOverridesに一致するパス（1件目） | 対応するCSP文字列が付与される                                 |
 * | T-05 | cspOverridesに一致しないパス       | 既定の `default-src 'none'` が付与される                      |
 * | T-06 | cspOverridesに一致するパス（2件目） | パスごとに異なるCSP文字列が付与される（Mapが複数エントリを区別する） |
 */

import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';

import { securityHeadersMiddleware } from '../../../src/http/securityHeadersMiddleware';

const buildApp = (): Hono => {
    const app = new Hono();
    app.use('*', securityHeadersMiddleware());
    app.get('/ping', (c) => c.json({ status: 'ok' }));
    return app;
};

const buildAppWithOverride = (): Hono => {
    const app = new Hono();
    app.use(
        '*',
        securityHeadersMiddleware({
            cspOverrides: new Map([
                ['/docs', "default-src 'self'"],
                ['/admin/flags', "default-src 'self'; script-src 'self'"],
            ]),
        }),
    );
    app.get('/docs', (c) => c.text('docs'));
    app.get('/admin/flags', (c) => c.text('admin'));
    app.get('/openapi.json', (c) => c.json({ openapi: '3.0.3' }));
    return app;
};

describe('securityHeadersMiddleware', () => {
    it('[T-01] 通常のレスポンス_セキュリティヘッダーが付与される', async () => {
        const app = buildApp();

        const res = await app.request('/ping');

        expect(res.headers.get('Content-Security-Policy')).toBe(
            "default-src 'none'",
        );
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    });

    it('[T-02] c.json()で組み立てたレスポンス_セキュリティヘッダーが付与される', async () => {
        const app = buildApp();

        const res = await app.request('/ping');
        const body = (await res.json()) as { status: string };

        expect(body.status).toBe('ok');
        expect(res.headers.has('Content-Security-Policy')).toBe(true);
    });

    it('[T-03] 複数回リクエスト_毎回同じヘッダー値が付与される', async () => {
        const app = buildApp();

        const res1 = await app.request('/ping');
        const res2 = await app.request('/ping');

        expect(res1.headers.get('X-Content-Type-Options')).toBe(
            res2.headers.get('X-Content-Type-Options'),
        );
    });

    it('[T-04] cspOverridesに一致するパス(1件目)_対応するCSP文字列が付与される', async () => {
        const app = buildAppWithOverride();

        const res = await app.request('/docs');

        expect(res.headers.get('Content-Security-Policy')).toBe(
            "default-src 'self'",
        );
    });

    it('[T-05] cspOverridesに一致しないパス_既定のCSPが付与される', async () => {
        const app = buildAppWithOverride();

        const res = await app.request('/openapi.json');

        expect(res.headers.get('Content-Security-Policy')).toBe(
            "default-src 'none'",
        );
    });

    it('[T-06] cspOverridesに一致するパス(2件目)_パスごとに異なるCSP文字列が付与される', async () => {
        const app = buildAppWithOverride();

        const res = await app.request('/admin/flags');

        expect(res.headers.get('Content-Security-Policy')).toBe(
            "default-src 'self'; script-src 'self'",
        );
    });
});
