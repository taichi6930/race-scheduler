/**
 * requireAppAuth のデシジョンテーブル
 *
 * | #    | ルート方針            | サービス間トークン | セッショントークン | 期待                          |
 * | ---- | ---------------------- | ------------------- | ------------------- | ------------------------------ |
 * | T-01 | public                 | なし                 | なし                 | 200                             |
 * | T-02 | service-only           | 正                   | なし                 | 200・isInternalServiceCall=true |
 * | T-03 | service-only           | なし                 | なし                 | 401                             |
 * | T-04 | service-only           | 誤                   | なし                 | 401                             |
 * | T-05 | session-only           | なし                 | 正                   | 200・getCurrentUserId()が一致   |
 * | T-06 | session-only           | なし                 | なし                 | 401                             |
 * | T-07 | session-only           | なし                 | 無効                 | 401                             |
 * | T-08 | session-only           | 正                   | なし                 | 401（サービス認証は通らない）   |
 * | T-09 | service-or-session     | 正                   | なし                 | 200（サービス経由）             |
 * | T-10 | service-or-session     | なし                 | 正                   | 200（セッション経由）           |
 * | T-11 | service-or-session     | なし                 | なし                 | 401                             |
 * | T-12 | 未列挙ルート            | なし                 | なし                 | 401（既定はservice-only）       |
 * | T-13 | ワイルドカードパス       | なし                 | 正                   | 200（`/auth/credential/*`が動的パスにマッチ） |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    DI_TOKENS,
    getCurrentUserId,
    isInternalServiceCall,
} from '@race-schedule/core';
import { Hono } from 'hono';
import 'reflect-metadata';
import { container } from 'tsyringe';
import {
    type AppAuthRoute,
    requireAppAuth,
} from '../../../src/middleware/appAuthMiddleware';
import type {
    IAuthRepository,
    SessionRecord,
} from '../../../src/repository/interface/IAuthRepository';

const VALID_SESSION_TOKEN = 'valid-session-token';
const SESSION_USER_ID = 'user-1';

class FakeAuthRepository implements Partial<IAuthRepository> {
    public async validateAndRefreshSession(
        token: string,
    ): Promise<SessionRecord | null> {
        if (token !== VALID_SESSION_TOKEN) return null;
        return { userId: SESSION_USER_ID, credentialId: 'cred-1' };
    }
}

const ROUTES: readonly AppAuthRoute[] = [
    { method: 'GET', path: '/public', policy: 'public' },
    { method: 'GET', path: '/service-only', policy: 'service-only' },
    { method: 'GET', path: '/session-only', policy: 'session-only' },
    { method: 'GET', path: '/either', policy: 'service-or-session' },
    { method: 'PATCH', path: '/auth/credential/*', policy: 'session-only' },
];

const buildApp = (): Hono => {
    const app = new Hono();
    app.use(
        '*',
        requireAppAuth(ROUTES, () => {}),
    );
    for (const path of [
        '/public',
        '/service-only',
        '/session-only',
        '/either',
    ]) {
        app.get(path, (c) =>
            c.json({
                isInternal: isInternalServiceCall(),
                userId: getCurrentUserId() ?? null,
            }),
        );
    }
    app.patch('/auth/credential/:id', (c) => c.json({ ok: true }));
    return app;
};

describe('requireAppAuth', () => {
    const originalToken = process.env.SERVICE_AUTH_TOKEN;

    beforeEach(() => {
        process.env.SERVICE_AUTH_TOKEN = 'expected-service-token';
        container.register(DI_TOKENS.AuthRepository, {
            useValue: new FakeAuthRepository(),
        });
    });

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.SERVICE_AUTH_TOKEN;
        } else {
            process.env.SERVICE_AUTH_TOKEN = originalToken;
        }
        container.clearInstances();
    });

    it('[T-01] public_認証なしで200を返す', async () => {
        const app = buildApp();
        const res = await app.request('/public');
        expect(res.status).toBe(200);
    });

    it('[T-02] service-only_正しいトークンで200かつisInternalServiceCallがtrue', async () => {
        const app = buildApp();
        const res = await app.request('/service-only', {
            headers: { 'X-Service-Auth-Token': 'expected-service-token' },
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ isInternal: true });
    });

    it('[T-03] service-only_トークン無しで401', async () => {
        const app = buildApp();
        const res = await app.request('/service-only');
        expect(res.status).toBe(401);
    });

    it('[T-04] service-only_誤トークンで401', async () => {
        const app = buildApp();
        const res = await app.request('/service-only', {
            headers: { 'X-Service-Auth-Token': 'wrong' },
        });
        expect(res.status).toBe(401);
    });

    it('[T-05] session-only_正しいセッショントークンで200かつgetCurrentUserIdが一致', async () => {
        const app = buildApp();
        const res = await app.request('/session-only', {
            headers: { Authorization: `Bearer ${VALID_SESSION_TOKEN}` },
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ userId: SESSION_USER_ID });
    });

    it('[T-06] session-only_Authorizationヘッダー無しで401', async () => {
        const app = buildApp();
        const res = await app.request('/session-only');
        expect(res.status).toBe(401);
    });

    it('[T-07] session-only_無効なセッショントークンで401', async () => {
        const app = buildApp();
        const res = await app.request('/session-only', {
            headers: { Authorization: 'Bearer invalid-token' },
        });
        expect(res.status).toBe(401);
    });

    it('[T-08] session-only_サービス間トークンのみでは401', async () => {
        const app = buildApp();
        const res = await app.request('/session-only', {
            headers: { 'X-Service-Auth-Token': 'expected-service-token' },
        });
        expect(res.status).toBe(401);
    });

    it('[T-09] service-or-session_サービス間トークンのみで200', async () => {
        const app = buildApp();
        const res = await app.request('/either', {
            headers: { 'X-Service-Auth-Token': 'expected-service-token' },
        });
        expect(res.status).toBe(200);
    });

    it('[T-10] service-or-session_セッショントークンのみで200', async () => {
        const app = buildApp();
        const res = await app.request('/either', {
            headers: { Authorization: `Bearer ${VALID_SESSION_TOKEN}` },
        });
        expect(res.status).toBe(200);
    });

    it('[T-11] service-or-session_どちらも無ければ401', async () => {
        const app = buildApp();
        const res = await app.request('/either');
        expect(res.status).toBe(401);
    });

    it('[T-12] 未列挙ルート_既定のservice-onlyとして401', async () => {
        const app = new Hono();
        app.use(
            '*',
            requireAppAuth(ROUTES, () => {}),
        );
        app.get('/unlisted', (c) => c.json({ ok: true }));

        const res = await app.request('/unlisted');
        expect(res.status).toBe(401);
    });

    it('[T-13] ワイルドカードパス_動的パスにマッチし正しいセッションで200', async () => {
        const app = buildApp();
        const res = await app.request('/auth/credential/abc123', {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${VALID_SESSION_TOKEN}` },
        });
        expect(res.status).toBe(200);
    });
});
