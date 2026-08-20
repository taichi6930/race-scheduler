/**
 * pushSubscriptionAndRequest.controller.usecase.repository.component.test.ts
 *
 * PUSHSUB-1 ~ PUSHREQ-2: POST/DELETE /push/subscription・POST/DELETE /push/request
 * エンドポイントのコンポーネントテスト（BEHAV-010〜013）。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemory D1（Drizzle）
 *
 * これらのエンドポイントは `APP_AUTH_ROUTES` で `session-only`（router.ts、front招待制
 * クローズド化）のため、`insertTestSession`（`test/common/sessionAuth.ts`）でInMemory D1へ
 * 有効なuser/credential/sessionを直接投入し、Authorizationヘッダーを付与して呼ぶ。
 * controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る
 * （`requestApi` ヘルパー経由）。
 *
 * ## シナリオテーブル
 *
 * | #          | 事前状態                 | リクエスト条件                          | 期待                                  |
 * |-------------|---------------------------|--------------------------------------------|-----------------------------------------|
 * | PUSHSUB-1   | 空                        | POST /push/subscription                    | 200・DBに1行永続化される               |
 * | PUSHSUB-2   | 購読1件登録済み           | DELETE /push/subscription                  | 200・DBから削除される                  |
 * | PUSHREQ-1   | 購読1件登録済み           | POST /push/request                         | 200・DBに1行永続化される               |
 * | PUSHREQ-2   | 購読1件・発火予約1件登録済み | DELETE /push/request                    | 200・DBから削除される                  |
 *
 * SECPUSH-02（P-1、push-ownership-design.md §2.4）: 購読シークレットの発行・検証
 *
 * | #          | 事前状態                 | リクエスト条件                          | 期待                                  |
 * |-------------|---------------------------|--------------------------------------------|-----------------------------------------|
 * | PUSHSEC-1   | 空                        | POST /push/subscription（新規発行）        | 200・応答にsecretを含む・DBにsecret_hashが保存される |
 * | PUSHSEC-2   | 購読1件登録済み（secret発行済み） | POST /push/subscription（正しいsecretを提示） | 200・応答にsecretを含まない・endpointが更新される |
 * | PUSHSEC-3   | 購読1件登録済み（secret発行済み） | POST /push/subscription（誤ったsecretを提示） | 401・DBの購読情報は更新されない |
 */

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { requestApi } from '../../common/requestApi';
import { insertTestSession } from '../../common/sessionAuth';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

const ENDPOINT = 'https://push.example.com/subscription/behav';
const RACE_ID = 'jra202601270501';

describe('コンポーネントテスト: Push Subscription/Request Router → Controller → Usecase → Repository → InMemory D1', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;
    /** session-only ルートのため、テスト用セッションのAuthorizationヘッダー */
    let sessionHeaders: Record<string, string>;

    beforeAll(() => {
        restoreEnv = useInMemoryDB();
    });

    afterAll(() => {
        restoreEnv();
    });

    beforeEach(async () => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
        sessionHeaders = await insertTestSession(db);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('PUSHSUB-1: POSTで購読が永続化されること', async () => {
        // Act
        const response = await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
            }),
        });
        const body = (await response.json()) as { id: string };

        // Assert
        expect(response.status).toBe(200);
        expect(body.id).toBeTruthy();
        const rows = await db.select().from(schema.pushSubscription);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.endpoint).toBe(ENDPOINT);
    });

    it('PUSHSUB-2: DELETEで購読がDBから削除されること', async () => {
        // Arrange
        const subscribeResponse = await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
            }),
        });
        expect(subscribeResponse.status).toBe(200);

        // Act
        const response = await requestApi(d1, '/push/subscription', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({ endpoint: ENDPOINT }),
        });

        // Assert
        expect(response.status).toBe(200);
        const rows = await db.select().from(schema.pushSubscription);
        expect(rows).toHaveLength(0);
    });

    it('PUSHREQ-1: POSTで発火予約が永続化されること', async () => {
        // Arrange
        const subscribeResponse = await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
            }),
        });
        const { id: subscriptionId } = (await subscribeResponse.json()) as {
            id: string;
        };

        // Act
        const response = await requestApi(d1, '/push/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                subscriptionId,
                raceId: RACE_ID,
                fireAtMs: Date.now() + 60_000,
                title: 'タイトル',
                body: '本文',
            }),
        });

        // Assert
        expect(response.status).toBe(200);
        const rows = await db.select().from(schema.pushNotificationRequest);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.raceId).toBe(RACE_ID);
    });

    it('PUSHREQ-2: DELETEで発火予約がDBから削除されること', async () => {
        // Arrange
        const subscribeResponse = await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
            }),
        });
        const { id: subscriptionId } = (await subscribeResponse.json()) as {
            id: string;
        };
        await requestApi(d1, '/push/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                subscriptionId,
                raceId: RACE_ID,
                fireAtMs: Date.now() + 60_000,
                title: 'タイトル',
                body: '本文',
            }),
        });

        // Act
        const response = await requestApi(d1, '/push/request', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({ subscriptionId, raceId: RACE_ID }),
        });

        // Assert
        expect(response.status).toBe(200);
        const rows = await db.select().from(schema.pushNotificationRequest);
        expect(rows).toHaveLength(0);
    });

    it('PUSHSEC-1: 新規登録時は応答にsecretを含み、DBにsecret_hashが保存されること', async () => {
        // Act
        const response = await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
            }),
        });
        const body = (await response.json()) as {
            id: string;
            secret?: string;
        };

        // Assert
        expect(response.status).toBe(200);
        expect(body.secret).toBeString();
        const rows = await db.select().from(schema.pushSubscription);
        expect(rows[0]?.secretHash).toBeString();
        expect(rows[0]?.secretHash?.length).toBeGreaterThan(0);
    });

    it('PUSHSEC-2: 発行済みsecretを正しく提示すると200・応答にsecretを含まず暗号鍵が更新されること', async () => {
        // Arrange（同一endpoint = 同一idの行を対象にするため、endpointは変えない）
        const subscribeResponse = await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
            }),
        });
        const { secret } = (await subscribeResponse.json()) as {
            secret: string;
        };

        // Act
        const response = await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Push-Subscription-Secret': secret,
                ...sessionHeaders,
            },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-rotated', auth: 'auth-rotated' },
            }),
        });
        const body = (await response.json()) as Record<string, unknown>;

        // Assert
        expect(response.status).toBe(200);
        expect('secret' in body).toBe(false);
        const rows = await db.select().from(schema.pushSubscription);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.p256dh).toBe('p256dh-rotated');
    });

    it('PUSHSEC-3: 誤ったsecretを提示すると401を返しDBの購読情報は更新されないこと', async () => {
        // Arrange
        await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionHeaders },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
            }),
        });

        // Act
        const response = await requestApi(d1, '/push/subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Push-Subscription-Secret': 'wrong-secret',
                ...sessionHeaders,
            },
            body: JSON.stringify({
                endpoint: ENDPOINT,
                keys: { p256dh: 'p256dh-tampered', auth: 'auth-tampered' },
            }),
        });

        // Assert
        expect(response.status).toBe(401);
        const rows = await db.select().from(schema.pushSubscription);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.p256dh).toBe('p256dh-value');
    });
});
