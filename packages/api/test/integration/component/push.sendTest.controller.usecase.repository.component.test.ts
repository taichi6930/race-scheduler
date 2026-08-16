/**
 * push.sendTest.controller.usecase.repository.component.test.ts
 *
 * PUSH-TEST-1 ~ PUSH-TEST-2: POST /push/test（テスト通知の即時送信）の
 * コンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository（InMemory D1） → Gateway（WebPush）
 *
 * controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る
 * （`requestApi` ヘルパー経由。詳細・設計方針は place.get...component.test.ts のコメントおよび
 * .claude/docs/testing-conventions.md §コンポーネントテスト を参照）。
 *
 * ## シナリオテーブル
 *
 * | #            | 投入データ           | リクエスト条件                  | 期待                                                    |
 * |---------------|----------------------|----------------------------------|-----------------------------------------------------------|
 * | PUSH-TEST-1   | 購読なし             | 未登録のsubscriptionId          | 200, ok:false, message:'購読が見つかりません'            |
 * | PUSH-TEST-2   | 購読1件（D1に登録）  | 登録済みsubscriptionId          | 200, ok:false（VAPID未設定のためgateway.sendが失敗）      |
 * | PUSH-TEST-3   | repositoryが例外     | 登録済みsubscriptionId          | 500（BEHAV-017。usecase内の未捕捉例外がcontrollerまで伝播）|
 *
 * 注: テスト環境では VAPID_PUBLIC_KEY 等が未設定のため、WebPushGateway.send は
 *     実際の Push Service へは到達せず、VAPID未設定エラーを捕捉して
 *     `{ ok: false, gone: false, message }` を返す（webPushGateway.test.ts S1 と同じ前提）。
 *     これにより Controller → Usecase → Repository → Gateway の配線を
 *     ネットワークアクセスなしで決定的に検証できる。
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
import { DI_TOKENS } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';
import { useInMemoryDB } from '../../../../../tests/shared/env';
import * as schema from '../../../src/db/schema';
import type { IPushSubscriptionRepository } from '../../../src/repository/interface/IPushSubscriptionRepository';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

interface PushTestSendResponseBody {
    ok: boolean;
    message?: string;
}

describe('コンポーネントテスト: Push sendTest Router → Controller → Usecase → Repository → Gateway', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;

    beforeAll(() => {
        restoreEnv = useInMemoryDB();
    });

    afterAll(() => {
        restoreEnv();
    });

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('PUSH-TEST-1: 購読が存在しない場合は200でok:falseを返すこと', async () => {
        // Act
        const response = await requestApi(d1, '/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: 'sub-not-exist' }),
        });
        const body = (await response.json()) as PushTestSendResponseBody;

        // Assert
        expect(response.status).toBe(200);
        expect(body.ok).toBe(false);
        expect(body.message).toBe('購読が見つかりません');
    });

    it('PUSH-TEST-2: 購読が存在する場合はgatewayまで到達し送信が試行されること（VAPID未設定のため失敗）', async () => {
        // Arrange
        await db.insert(schema.pushSubscription).values({
            id: 'sub-1',
            endpoint: 'https://push.example.com/subscription/1',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
        });

        // Act
        const response = await requestApi(d1, '/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: 'sub-1' }),
        });
        const body = (await response.json()) as PushTestSendResponseBody;

        // Assert（購読は見つかるが、VAPID未設定のためgateway.sendが失敗する）
        expect(response.status).toBe(200);
        expect(body.ok).toBe(false);
        expect(body.message).toContain('VAPID_PUBLIC_KEY');

        // 購読はgone扱いされていないため削除されず残っていること
        const rows = await db.select().from(schema.pushSubscription);
        expect(rows).toHaveLength(1);
    });

    it('PUSH-TEST-3: repositoryが例外を投げた場合500を返すこと', async () => {
        // Arrange: PushSubscriptionRepositoryをDBエラーを投げるスタブに差し替える
        const throwingRepository: IPushSubscriptionRepository = {
            upsert: () => Promise.reject(new Error('db unavailable')),
            remove: () => Promise.reject(new Error('db unavailable')),
            removeWithDependentRequests: () =>
                Promise.reject(new Error('db unavailable')),
            removeWithDependentRequestsBatch: () =>
                Promise.reject(new Error('db unavailable')),
            findById: () => Promise.reject(new Error('db unavailable')),
            incrementFailureCount: () =>
                Promise.reject(new Error('db unavailable')),
            incrementFailureCountBatch: () =>
                Promise.reject(new Error('db unavailable')),
            resetFailureCount: () =>
                Promise.reject(new Error('db unavailable')),
            resetFailureCountBatch: () =>
                Promise.reject(new Error('db unavailable')),
            findSecretHashById: () =>
                Promise.reject(new Error('db unavailable')),
            purgeStale: () => Promise.reject(new Error('db unavailable')),
        };
        container.register(DI_TOKENS.PushSubscriptionRepository, {
            useValue: throwingRepository,
        });

        // Act
        const response = await requestApi(d1, '/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: 'sub-1' }),
        });

        // Assert
        expect(response.status).toBe(500);
    });
});
