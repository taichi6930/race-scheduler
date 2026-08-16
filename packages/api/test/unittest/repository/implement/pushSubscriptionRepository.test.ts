/**
 * pushSubscriptionRepository.test.ts - PushSubscriptionRepository ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: upsert()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | U1 | 新規ID | 1行INSERTされる |
 * | U2 | 既存ID | endpoint/p256dh/auth が更新される（ON CONFLICT DO UPDATE） |
 * | U3 | 新規ID・secretHash指定（SECPUSH-02） | secret_hashが保存される |
 * | U4 | 既存ID・secretHash未指定（SECPUSH-02） | 既存のsecret_hashが変更されない |
 * | U5 | 既存ID・secretHash指定（SECPUSH-02） | secret_hashが上書きされる |
 *
 * ### メソッド: findSecretHashById()（SECPUSH-02）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | FS1 | 該当ID・secret_hash未設定 | null を返す |
 * | FS2 | 該当ID・secret_hash設定済み | ハッシュ値を返す |
 * | FS3 | 該当なし | undefined を返す |
 *
 * ### メソッド: remove()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | R1 | 該当ID | 該当行が削除される |
 *
 * ### メソッド: findById()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | F1 | 該当ID | 該当する購読情報を返す |
 * | F2 | 該当なし | undefined を返す |
 *
 * ### メソッド: removeWithDependentRequests()（CONC-08）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | W1 | 購読1件＋紐づく予約2件 | 購読・予約とも削除される（単一batchで両テーブルとも消える） |
 * | W2 | 他購読に紐づく予約が別途存在 | 対象外の購読・予約は削除されず残る |
 *
 * ### メソッド: removeWithDependentRequestsBatch()（CFDATA-06）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | WB1 | 購読2件＋それぞれに紐づく予約 | 指定した全購読・予約が削除される |
 * | WB2 | 空配列 | 何も削除されない（クエリが発行されない） |
 *
 * ### メソッド: incrementFailureCount()（OBS-024）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | I1 | 該当ID・failure_count=0 | 1にインクリメントされ、1を返す |
 * | I2 | 該当ID・failure_count=2（複数回呼び出し） | 呼び出すたびに1ずつ増える |
 * | I3 | 該当なし | undefined を返す |
 *
 * ### メソッド: incrementFailureCountBatch()（CFDATA-06）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | IB1 | 該当ID2件・failure_count=0 | 両方とも1にインクリメントされ、id→1のMapを返す |
 * | IB2 | 同一IDを重複して渡す（ponytail） | 1回分（+1）のみ加算される |
 * | IB3 | 空配列 | 何も更新されず空のMapを返す |
 *
 * ### メソッド: resetFailureCount()（OBS-024）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | Z1 | failure_count=3 | 0にリセットされる |
 *
 * ### メソッド: resetFailureCountBatch()（CFDATA-06）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | ZB1 | failure_count=3の行が複数 | 指定した全行が0にリセットされる |
 * | ZB2 | 空配列 | 何も更新されない（クエリが発行されない） |
 *
 * ### メソッド: purgeStale()（SEC-053）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | PS1 | 閾値より古いupdated_atの購読＋紐づく予約 | 購読・予約とも削除され、削除件数を返す |
 * | PS2 | 閾値内（新しい）updated_atの購読 | 削除されない |
 * | PS3 | 対象なし | 何も削除されず0を返す |
 *
 * ### upsert()/findById() の暗号化配線（SEC-053）
 * | ケース | PUSH_AUTH_ENCRYPTION_KEY | 期待値 |
 * |--------|----------------------------|--------|
 * | E1 | 設定済み | DBにはencv1:接頭辞の暗号文が保存され、findByIdは元のauth平文を返す |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { type CloudFlareEnv, EnvStore } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { PushSubscriptionRepository } from '../../../../src/repository/implement/pushSubscriptionRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

describe('PushSubscriptionRepository', () => {
    let repository: PushSubscriptionRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new PushSubscriptionRepository(drizzleGateway);
    });

    afterEach(() => {
        EnvStore.reset();
    });

    describe('upsert', () => {
        // U1: 新規ID → 1行INSERTされる
        it('U1: 新規IDの場合は1行INSERTされる', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
        });

        // U2: 既存ID → endpoint/p256dh/auth が更新される
        it('U2: 既存IDの場合はendpoint/p256dh/authが更新される', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/old',
                p256dh: 'old-p256dh',
                auth: 'old-auth',
            });

            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/new',
                p256dh: 'new-p256dh',
                auth: 'new-auth',
            });

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                id: 'sub-1',
                endpoint: 'https://push.example.com/new',
                p256dh: 'new-p256dh',
                auth: 'new-auth',
            });
        });

        // U3: 新規ID・secretHash指定 → secret_hashが保存される
        it('U3: 新規IDでsecretHashを指定した場合はsecret_hashが保存されること', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
                secretHash: 'hash-1',
            });

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows[0]?.secretHash).toBe('hash-1');
        });

        // U4: 既存ID・secretHash未指定 → 既存のsecret_hashが変更されない
        it('U4: 既存IDでsecretHash未指定の場合は既存のsecret_hashが変更されないこと', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
                secretHash: 'hash-1',
            });

            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/new',
                p256dh: 'new-p256dh',
                auth: 'new-auth',
            });

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows[0]?.secretHash).toBe('hash-1');
        });

        // U5: 既存ID・secretHash指定 → secret_hashが上書きされる
        it('U5: 既存IDでsecretHashを指定した場合はsecret_hashが上書きされること', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
                secretHash: 'hash-1',
            });

            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
                secretHash: 'hash-2',
            });

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows[0]?.secretHash).toBe('hash-2');
        });
    });

    describe('remove', () => {
        // R1: 該当ID → 該当行が削除される
        it('R1: 指定IDの行が削除される', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });

            await repository.remove('sub-1');

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows).toHaveLength(0);
        });
    });

    describe('findById', () => {
        // F1: 該当ID → 該当する購読情報を返す
        it('F1: 該当IDが存在する場合は購読情報を返す', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });

            const result = await repository.findById('sub-1');

            expect(result).toMatchObject({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
        });

        // F2: 該当なし → undefined を返す
        it('F2: 該当IDが存在しない場合はundefinedを返す', async () => {
            const result = await repository.findById('not-exist');

            expect(result).toBeUndefined();
        });
    });

    describe('findSecretHashById', () => {
        // FS1: 該当ID・secret_hash未設定 → null を返す
        it('FS1: secret_hash未設定の場合はnullを返す', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });

            const result = await repository.findSecretHashById('sub-1');

            expect(result).toBeNull();
        });

        // FS2: 該当ID・secret_hash設定済み → ハッシュ値を返す
        it('FS2: secret_hash設定済みの場合はハッシュ値を返す', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
                secretHash: 'hash-1',
            });

            const result = await repository.findSecretHashById('sub-1');

            expect(result).toBe('hash-1');
        });

        // FS3: 該当なし → undefined を返す
        it('FS3: 該当IDが存在しない場合はundefinedを返す', async () => {
            const result = await repository.findSecretHashById('not-exist');

            expect(result).toBeUndefined();
        });
    });

    describe('removeWithDependentRequests', () => {
        /** 予約1件をpush_notification_requestへ直接INSERTするヘルパー */
        const insertRequest = async (id: string, subscriptionId: string) => {
            await db.insert(schema.pushNotificationRequest).values({
                id,
                subscriptionId,
                raceId: 'jra202601010101',
                fireAtMs: 1_700_000_000_000,
                title: 'テストレース',
                body: '本文',
            });
        };

        // W1: 購読1件＋紐づく予約2件 → 購読・予約とも削除される
        it('W1: 購読と紐づく予約がすべて削除される', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
            await insertRequest('sub-1:race-1', 'sub-1');
            await insertRequest('sub-1:race-2', 'sub-1');

            await repository.removeWithDependentRequests('sub-1');

            const subscriptionRows = await db
                .select()
                .from(schema.pushSubscription);
            const requestRows = await db
                .select()
                .from(schema.pushNotificationRequest);
            expect(subscriptionRows).toHaveLength(0);
            expect(requestRows).toHaveLength(0);
        });

        // W2: 他購読に紐づく予約が別途存在 → 対象外の購読・予約は残る
        it('W2: 対象外の購読・予約は削除されず残る', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
            await repository.upsert({
                id: 'sub-2',
                endpoint: 'https://push.example.com/2',
                p256dh: 'p256dh-2',
                auth: 'auth-2',
            });
            await insertRequest('sub-1:race-1', 'sub-1');
            await insertRequest('sub-2:race-1', 'sub-2');

            await repository.removeWithDependentRequests('sub-1');

            const subscriptionRows = await db
                .select()
                .from(schema.pushSubscription);
            const requestRows = await db
                .select()
                .from(schema.pushNotificationRequest);
            expect(subscriptionRows).toHaveLength(1);
            expect(subscriptionRows[0]?.id).toBe('sub-2');
            expect(requestRows).toHaveLength(1);
            expect(requestRows[0]?.subscriptionId).toBe('sub-2');
        });
    });

    describe('removeWithDependentRequestsBatch', () => {
        const insertRequest = async (id: string, subscriptionId: string) => {
            await db.insert(schema.pushNotificationRequest).values({
                id,
                subscriptionId,
                raceId: 'jra202601010101',
                fireAtMs: 1_700_000_000_000,
                title: 'テストレース',
                body: '本文',
            });
        };

        // WB1: 購読2件＋それぞれに紐づく予約 → 指定した全購読・予約が削除される
        it('WB1: 指定した全購読・予約が削除される', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
            await repository.upsert({
                id: 'sub-2',
                endpoint: 'https://push.example.com/2',
                p256dh: 'p256dh-2',
                auth: 'auth-2',
            });
            await repository.upsert({
                id: 'sub-3',
                endpoint: 'https://push.example.com/3',
                p256dh: 'p256dh-3',
                auth: 'auth-3',
            });
            await insertRequest('sub-1:race-1', 'sub-1');
            await insertRequest('sub-2:race-1', 'sub-2');
            await insertRequest('sub-3:race-1', 'sub-3');

            await repository.removeWithDependentRequestsBatch([
                'sub-1',
                'sub-2',
            ]);

            const subscriptionRows = await db
                .select()
                .from(schema.pushSubscription);
            const requestRows = await db
                .select()
                .from(schema.pushNotificationRequest);
            expect(subscriptionRows).toHaveLength(1);
            expect(subscriptionRows[0]?.id).toBe('sub-3');
            expect(requestRows).toHaveLength(1);
            expect(requestRows[0]?.subscriptionId).toBe('sub-3');
        });

        // WB2: 空配列 → 何も削除されない
        it('WB2: 空配列の場合は何も削除されないこと', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
            await insertRequest('sub-1:race-1', 'sub-1');

            await repository.removeWithDependentRequestsBatch([]);

            const subscriptionRows = await db
                .select()
                .from(schema.pushSubscription);
            expect(subscriptionRows).toHaveLength(1);
        });
    });

    describe('incrementFailureCount', () => {
        // I1: 該当ID・failure_count=0 → 1にインクリメントされ、1を返す
        it('I1: 初回呼び出しで1にインクリメントされ1を返す', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });

            const result = await repository.incrementFailureCount('sub-1');

            expect(result).toBe(1);
            const rows = await db.select().from(schema.pushSubscription);
            expect(rows[0]?.failureCount).toBe(1);
        });

        // I2: 該当ID・failure_count=2（複数回呼び出し） → 呼び出すたびに1ずつ増える
        it('I2: 複数回呼び出すたびに1ずつ増える', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });

            await repository.incrementFailureCount('sub-1');
            await repository.incrementFailureCount('sub-1');
            const result = await repository.incrementFailureCount('sub-1');

            expect(result).toBe(3);
        });

        // I3: 該当なし → undefined を返す
        it('I3: 該当IDが存在しない場合はundefinedを返す', async () => {
            const result = await repository.incrementFailureCount('not-exist');

            expect(result).toBeUndefined();
        });
    });

    describe('incrementFailureCountBatch', () => {
        // IB1: 該当ID2件・failure_count=0 → 両方とも1にインクリメントされる
        it('IB1: 指定した全IDが1にインクリメントされid→1のMapを返す', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
            await repository.upsert({
                id: 'sub-2',
                endpoint: 'https://push.example.com/2',
                p256dh: 'p256dh-2',
                auth: 'auth-2',
            });

            const result = await repository.incrementFailureCountBatch([
                'sub-1',
                'sub-2',
            ]);

            expect(result.get('sub-1')).toBe(1);
            expect(result.get('sub-2')).toBe(1);
        });

        // IB2 (ponytail): 同一IDを重複して渡しても1回分(+1)のみ加算される
        it('IB2: 同一IDを重複して渡しても1回分のみ加算されること', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });

            const result = await repository.incrementFailureCountBatch([
                'sub-1',
                'sub-1',
            ]);

            expect(result.get('sub-1')).toBe(1);
        });

        // IB3: 空配列 → 何も更新されず空のMapを返す
        it('IB3: 空配列の場合は空のMapを返すこと', async () => {
            const result = await repository.incrementFailureCountBatch([]);

            expect(result.size).toBe(0);
        });
    });

    describe('resetFailureCount', () => {
        // Z1: failure_count=3 → 0にリセットされる
        it('Z1: 連続失敗回数が0にリセットされる', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
            await repository.incrementFailureCount('sub-1');
            await repository.incrementFailureCount('sub-1');
            await repository.incrementFailureCount('sub-1');

            await repository.resetFailureCount('sub-1');

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows[0]?.failureCount).toBe(0);
        });
    });

    describe('resetFailureCountBatch', () => {
        // ZB1: failure_count=3の行が複数 → 指定した全行が0にリセットされる
        it('ZB1: 指定した全IDの連続失敗回数が0にリセットされること', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
            await repository.upsert({
                id: 'sub-2',
                endpoint: 'https://push.example.com/2',
                p256dh: 'p256dh-2',
                auth: 'auth-2',
            });
            await repository.incrementFailureCountBatch(['sub-1', 'sub-2']);
            await repository.incrementFailureCountBatch(['sub-1', 'sub-2']);

            await repository.resetFailureCountBatch(['sub-1', 'sub-2']);

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows.every((row) => row.failureCount === 0)).toBe(true);
        });

        // ZB2: 空配列 → 何も更新されない
        it('ZB2: 空配列の場合は何も更新されないこと', async () => {
            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'auth-1',
            });
            await repository.incrementFailureCount('sub-1');

            await repository.resetFailureCountBatch([]);

            const rows = await db.select().from(schema.pushSubscription);
            expect(rows[0]?.failureCount).toBe(1);
        });
    });

    describe('purgeStale', () => {
        /**
         * updated_at を指定日時で直接INSERTするヘルパー。
         * @remarks repository.upsert() 経由だとON CONFLICT時にトリガーが
         * updated_at をCURRENT_TIMESTAMPへ上書きしてしまうため、古い
         * updated_at を持つ行を作るにはDBへ直接INSERTする必要がある。
         */
        const insertWithUpdatedAt = async (id: string, updatedAt: string) => {
            await db.insert(schema.pushSubscription).values({
                id,
                endpoint: `https://push.example.com/${id}`,
                p256dh: `p256dh-${id}`,
                auth: `auth-${id}`,
                updatedAt,
            });
        };

        const insertRequest = async (id: string, subscriptionId: string) => {
            await db.insert(schema.pushNotificationRequest).values({
                id,
                subscriptionId,
                raceId: 'jra202601010101',
                fireAtMs: 1_700_000_000_000,
                title: 'テストレース',
                body: '本文',
            });
        };

        // PS1: 閾値より古いupdated_atの購読＋紐づく予約 → 購読・予約とも削除される
        it('PS1: 閾値より古い購読と紐づく予約が削除され、削除件数を返す', async () => {
            await insertWithUpdatedAt('sub-old', '2000-01-01 00:00:00');
            await insertRequest('sub-old:race-1', 'sub-old');

            const purged = await repository.purgeStale(365);

            expect(purged).toBe(1);
            const subscriptionRows = await db
                .select()
                .from(schema.pushSubscription);
            const requestRows = await db
                .select()
                .from(schema.pushNotificationRequest);
            expect(subscriptionRows).toHaveLength(0);
            expect(requestRows).toHaveLength(0);
        });

        // PS2: 閾値内（新しい）updated_atの購読 → 削除されない
        it('PS2: 閾値内の購読は削除されないこと', async () => {
            await repository.upsert({
                id: 'sub-recent',
                endpoint: 'https://push.example.com/recent',
                p256dh: 'p256dh-recent',
                auth: 'auth-recent',
            });

            const purged = await repository.purgeStale(365);

            expect(purged).toBe(0);
            const rows = await db.select().from(schema.pushSubscription);
            expect(rows).toHaveLength(1);
        });

        // PS3: 対象なし → 何も削除されず0を返す
        it('PS3: 対象が無い場合は0を返すこと', async () => {
            const purged = await repository.purgeStale(365);

            expect(purged).toBe(0);
        });
    });

    describe('upsert/findById の暗号化配線（SEC-053）', () => {
        const toBase64Url = (bytes: Uint8Array): string => {
            const binary = String.fromCodePoint(...bytes);
            return btoa(binary)
                .replaceAll('+', '-')
                .replaceAll('/', '_')
                .replace(/=+$/, '');
        };

        // E1: PUSH_AUTH_ENCRYPTION_KEY設定済み → DB上は暗号文、findByIdは平文を返す
        it('E1: DBにはencv1:接頭辞の暗号文が保存され、findByIdは元のauth平文を返すこと', async () => {
            EnvStore.setEnv({
                JRA_CALENDAR_ID: 'mock-jra',
                NAR_CALENDAR_ID: 'mock-nar',
                KEIRIN_CALENDAR_ID: 'mock-keirin',
                AUTORACE_CALENDAR_ID: 'mock-autorace',
                BOATRACE_CALENDAR_ID: 'mock-boatrace',
                GOOGLE_CLIENT_EMAIL: 'mock@example.com',
                GOOGLE_PRIVATE_KEY: 'mock-private-key',
                R2_BUCKET: {},
                PUSH_AUTH_ENCRYPTION_KEY: toBase64Url(
                    crypto.getRandomValues(new Uint8Array(32)),
                ),
            } as unknown as CloudFlareEnv);

            await repository.upsert({
                id: 'sub-1',
                endpoint: 'https://push.example.com/1',
                p256dh: 'p256dh-1',
                auth: 'plain-auth-value',
            });

            const rawRows = await db.select().from(schema.pushSubscription);
            expect(rawRows[0]?.auth.startsWith('encv1:')).toBe(true);
            expect(rawRows[0]?.auth).not.toBe('plain-auth-value');

            const found = await repository.findById('sub-1');
            expect(found?.auth).toBe('plain-auth-value');
        });
    });
});
