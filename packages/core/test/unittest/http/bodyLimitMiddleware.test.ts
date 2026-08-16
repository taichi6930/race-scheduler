/**
 * bodyLimitMiddleware のデシジョンテーブル（SEC-029）
 *
 * | #    | 対象メソッド | 条件                                    | 期待                                                    |
 * | ---- | ------------- | ----------------------------------------- | --------------------------------------------------------- |
 * | T-01 | POST          | ボディが1MB以下                         | 200（リクエストが通過する）                              |
 * | T-02 | POST          | ボディが1MBを超える                     | 413、`{status: 413, message: 'Request body exceeds 1MB limit'}` |
 * | T-03 | PUT           | ボディが1MBを超える                     | 413（PUTも対象）                                         |
 * | T-04 | DELETE        | ボディが1MBを超える                     | 413（DELETEも対象）                                      |
 * | T-05 | GET           | POST/PUT/DELETE以外のメソッドで登録していない | 制限が適用されず200（対象外メソッドはそもそも評価されない） |
 */

import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';

import { bodyLimitMiddleware } from '../../../src/http/bodyLimitMiddleware';

const MAX_BODY_SIZE = 1024 * 1024;

const buildApp = (): Hono => {
    const app = new Hono();
    app.on(['POST', 'PUT', 'DELETE'], '*', bodyLimitMiddleware());
    app.post('/echo', (c) => c.json({ status: 'ok' }));
    app.put('/echo', (c) => c.json({ status: 'ok' }));
    app.delete('/echo', (c) => c.json({ status: 'ok' }));
    app.get('/echo', (c) => c.json({ status: 'ok' }));
    return app;
};

const buildRequest = (method: string, bodySize: number): Request => {
    const body = 'x'.repeat(bodySize);
    return new Request('http://localhost/echo', {
        method,
        headers: {
            'Content-Type': 'text/plain',
            'Content-Length': String(body.length),
        },
        body: method === 'GET' ? undefined : body,
    });
};

describe('bodyLimitMiddleware', () => {
    it('[T-01] POST_ボディが1MB以下_200を返す', async () => {
        const app = buildApp();

        const res = await app.fetch(buildRequest('POST', MAX_BODY_SIZE));

        expect(res.status).toBe(200);
    });

    it('[T-02] POST_ボディが1MBを超える_413とエラーメッセージを返す', async () => {
        const app = buildApp();

        const res = await app.fetch(buildRequest('POST', MAX_BODY_SIZE + 1));

        expect(res.status).toBe(413);
        const body = (await res.json()) as { status: number; message: string };
        expect(body).toEqual({
            status: 413,
            message: 'Request body exceeds 1MB limit',
        });
    });

    it('[T-03] PUT_ボディが1MBを超える_413を返す', async () => {
        const app = buildApp();

        const res = await app.fetch(buildRequest('PUT', MAX_BODY_SIZE + 1));

        expect(res.status).toBe(413);
    });

    it('[T-04] DELETE_ボディが1MBを超える_413を返す', async () => {
        const app = buildApp();

        const res = await app.fetch(buildRequest('DELETE', MAX_BODY_SIZE + 1));

        expect(res.status).toBe(413);
    });

    it('[T-05] GET_POST/PUT/DELETE以外は登録されていないため制限が適用されない', async () => {
        const app = buildApp();

        const res = await app.fetch(buildRequest('GET', 0));

        expect(res.status).toBe(200);
    });
});
