/**
 * pushRequestRepository.test.ts - PushRequestRepository ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: upsert()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | U1 | 新規ID・urlあり | 1行INSERTされる |
 * | U2 | 新規ID・url省略 | url が null で保存される |
 * | U3 | 既存ID（送信済み） | 内容が更新され sentAt が null に戻る（冪等な上書き） |
 *
 * ### メソッド: remove()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | R1 | 該当ID | 該当行が削除される |
 *
 * ### メソッド: removeBySubscriptionId()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | S1 | 同一subscriptionIdの行が複数 | 該当するすべての行が削除される |
 * | S2 | 別subscriptionIdの行は残す | 対象外の行は削除されない |
 *
 * ### メソッド: fetchDue()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | D1 | 未送信・fireAtMs <= now | 取得される |
 * | D2 | 未送信・fireAtMs > now（未来） | 取得されない |
 * | D3 | 送信済み・fireAtMs <= now | 取得されない |
 * | D4 | 対応する購読が存在しない（孤児予約） | INNER JOINで除外され取得されない |
 * | D5 | 複数件が期限到来 | fireAtMs昇順で返り、limitで件数が制限される |
 * | D6 | 直前のfetchDueで既にクレーム済み（CONC-01） | 2回目のfetchDueでは取得されない（二重取得防止） |
 * | D7 | 購読のauthが暗号化済み・PUSH_AUTH_ENCRYPTION_KEY設定済み（SEC-053） | authは復号された平文で返る（pushSubscription.authをJOINで直接読むためdecryptPushAuthを個別に通す必要がある） |
 *
 * ### メソッド: markSent()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | MS1 | 未送信の行 | sentAtがnullでなくなる |
 *
 * ### メソッド: markSentBatch()（CFDATA-06）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | MSB1 | 未送信の行が複数 | 指定した全行のsentAtがnullでなくなる |
 * | MSB2 | 空配列 | 何も更新されない（クエリが発行されない） |
 *
 * ### メソッド: releaseClaim()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | RC1 | fetchDueでクレーム済み（sentAt設定済み）の行 | sentAtがnullに戻り、再びfetchDueで取得できるようになる（CONC-01） |
 *
 * ### メソッド: releaseClaimBatch()（CFDATA-06）
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | RCB1 | クレーム済みの行が複数 | 指定した全行のsentAtがnullに戻る |
 * | RCB2 | 空配列 | 何も更新されない（クエリが発行されない） |
 *
 * ### メソッド: purgeOld()
 * | ケース | DB状態 | 期待値 |
 * |--------|--------|--------|
 * | PO1 | fireAtMs < beforeMs | 削除される |
 * | PO2 | fireAtMs >= beforeMs | 削除されない |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    type CloudFlareEnv,
    EnvStore,
    validateRaceId,
} from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { PushRequestRepository } from '../../../../src/repository/implement/pushRequestRepository';
import { encryptPushAuth } from '../../../../src/utility/pushAuthEncryption';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

describe('PushRequestRepository', () => {
    let repository: PushRequestRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new PushRequestRepository(drizzleGateway);
    });

    afterEach(() => {
        EnvStore.reset();
    });

    const insertSubscription = async (id: string): Promise<void> => {
        await db.insert(schema.pushSubscription).values({
            id,
            endpoint: `https://push.example.com/subscription/${id}`,
            p256dh: `p256dh-${id}`,
            auth: `auth-${id}`,
        });
    };

    describe('upsert', () => {
        // U1: 新規ID・urlあり → 1行INSERTされる
        it('U1: 新規ID・urlありの場合は1行INSERTされる', async () => {
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: '皐月賞（GⅠ）',
                body: '中山 11R ・ 発走 5分前',
                url: '/timeline',
            });

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: 'jra202601010101',
                fireAtMs: 1_700_000_000_000,
                title: '皐月賞（GⅠ）',
                body: '中山 11R ・ 発走 5分前',
                url: '/timeline',
                sentAt: null,
            });
        });

        // U2: 新規ID・url省略 → url が null で保存される
        it('U2: urlを省略した場合はnullで保存される', async () => {
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: '皐月賞（GⅠ）',
                body: '中山 11R ・ 発走 5分前',
            });

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows[0].url).toBeNull();
        });

        // U3: 既存ID（送信済み）→ 内容が更新されsentAtがnullに戻る
        it('U3: 既存ID（送信済み）の場合は内容が更新されsentAtがnullに戻る', async () => {
            const id = 'sub-1:jra202601010101';
            await repository.upsert({
                id,
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: '旧タイトル',
                body: '旧本文',
            });
            await db
                .update(schema.pushNotificationRequest)
                .set({ sentAt: '2026-01-01 00:00:00' });

            await repository.upsert({
                id,
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_800_000_000_000,
                title: '新タイトル',
                body: '新本文',
            });

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                fireAtMs: 1_800_000_000_000,
                title: '新タイトル',
                body: '新本文',
                sentAt: null,
            });
        });
    });

    describe('remove', () => {
        // R1: 該当ID → 該当行が削除される
        it('R1: 指定IDの行が削除される', async () => {
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: 'タイトル',
                body: '本文',
            });

            await repository.remove('sub-1:jra202601010101');

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows).toHaveLength(0);
        });
    });

    describe('removeBySubscriptionId', () => {
        // S1/S2: 同一subscriptionIdの行のみ削除され、別subscriptionIdの行は残る
        it('S1/S2: 同一subscriptionIdの行のみ削除され別の行は残る', async () => {
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: 'A',
                body: 'A',
            });
            await repository.upsert({
                id: 'sub-1:jra202601010102',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010102'),
                fireAtMs: 1_700_000_000_000,
                title: 'B',
                body: 'B',
            });
            await repository.upsert({
                id: 'sub-2:jra202601010101',
                subscriptionId: 'sub-2',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: 'C',
                body: 'C',
            });

            await repository.removeBySubscriptionId('sub-1');

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows).toHaveLength(1);
            expect(rows[0].subscriptionId).toBe('sub-2');
        });
    });

    describe('fetchDue', () => {
        const NOW = 1_700_000_000_000;

        it('D1: 未送信かつfireAtMs<=nowの行は取得されること', async () => {
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 1_000,
                title: 'タイトル',
                body: '本文',
                url: '/timeline',
            });

            const dueRequests = await repository.fetchDue(NOW, 100);

            expect(dueRequests).toHaveLength(1);
            expect(dueRequests[0]).toMatchObject({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                // QNTF-02: 通知の tag（同一レースの重複通知の集約）に使うため
                // fetchDue の結果にも raceId が含まれること。
                raceId: 'jra202601010101',
                title: 'タイトル',
                body: '本文',
                url: '/timeline',
                endpoint: 'https://push.example.com/subscription/sub-1',
                p256dh: 'p256dh-sub-1',
                auth: 'auth-sub-1',
            });
        });

        it('D2: 未送信でもfireAtMs>now（未来）の行は取得されないこと', async () => {
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW + 1_000,
                title: 'タイトル',
                body: '本文',
            });

            const dueRequests = await repository.fetchDue(NOW, 100);

            expect(dueRequests).toHaveLength(0);
        });

        it('D3: 送信済みの行はfireAtMs<=nowでも取得されないこと', async () => {
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 1_000,
                title: 'タイトル',
                body: '本文',
            });
            await repository.markSent('sub-1:jra202601010101');

            const dueRequests = await repository.fetchDue(NOW, 100);

            expect(dueRequests).toHaveLength(0);
        });

        it('D4: 対応する購読が存在しない予約（孤児予約）は取得されないこと', async () => {
            // insertSubscriptionを呼ばず、購読が存在しない状態で予約だけ作る
            await repository.upsert({
                id: 'sub-orphan:jra202601010101',
                subscriptionId: 'sub-orphan',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 1_000,
                title: 'タイトル',
                body: '本文',
            });

            const dueRequests = await repository.fetchDue(NOW, 100);

            expect(dueRequests).toHaveLength(0);
        });

        it('D5: 複数件が期限到来している場合はfireAtMs昇順で返りlimitで件数が制限されること', async () => {
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:race-2',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010102'),
                fireAtMs: NOW - 1_000,
                title: 'B',
                body: 'B',
            });
            await repository.upsert({
                id: 'sub-1:race-1',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 2_000,
                title: 'A',
                body: 'A',
            });
            await repository.upsert({
                id: 'sub-1:race-3',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010103'),
                fireAtMs: NOW - 500,
                title: 'C',
                body: 'C',
            });

            const dueRequests = await repository.fetchDue(NOW, 2);

            expect(dueRequests).toHaveLength(2);
            expect(dueRequests.map((r) => r.title)).toEqual(['A', 'B']);
        });

        // D6 (CONC-01): 直前のfetchDueで既にクレーム済みの行は、
        // 同じnowMsで再度fetchDueを呼んでも取得されない（二重取得防止）
        it('D6: 直前のfetchDueでクレーム済みの行は再度取得されないこと', async () => {
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 1_000,
                title: 'タイトル',
                body: '本文',
            });

            const first = await repository.fetchDue(NOW, 100);
            const second = await repository.fetchDue(NOW, 100);

            expect(first).toHaveLength(1);
            expect(second).toHaveLength(0);
        });

        // D7 (SEC-053): 購読のauthが暗号化済み・鍵設定済み → 復号された平文で返る
        it('D7: 購読のauthが暗号化済みの場合、fetchDueは復号された平文を返すこと', async () => {
            const toBase64Url = (bytes: Uint8Array): string => {
                const binary = String.fromCodePoint(...bytes);
                return btoa(binary)
                    .replaceAll('+', '-')
                    .replaceAll('/', '_')
                    .replace(/=+$/, '');
            };
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
            const encryptedAuth = await encryptPushAuth('plain-auth-value');
            await db.insert(schema.pushSubscription).values({
                id: 'sub-1',
                endpoint: 'https://push.example.com/subscription/sub-1',
                p256dh: 'p256dh-sub-1',
                auth: encryptedAuth,
            });
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 1_000,
                title: 'タイトル',
                body: '本文',
            });

            const dueRequests = await repository.fetchDue(NOW, 100);

            expect(dueRequests[0]?.auth).toBe('plain-auth-value');
        });
    });

    describe('markSent', () => {
        it('MS1: 未送信の行のsentAtがnullでなくなること', async () => {
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: 'タイトル',
                body: '本文',
            });

            await repository.markSent('sub-1:jra202601010101');

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows[0].sentAt).not.toBeNull();
        });
    });

    describe('markSentBatch', () => {
        it('MSB1: 指定した全行のsentAtがnullでなくなること', async () => {
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:race-1',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: 'A',
                body: 'A',
            });
            await repository.upsert({
                id: 'sub-1:race-2',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010102'),
                fireAtMs: 1_700_000_000_000,
                title: 'B',
                body: 'B',
            });

            await repository.markSentBatch(['sub-1:race-1', 'sub-1:race-2']);

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows.every((row) => row.sentAt !== null)).toBe(true);
        });

        it('MSB2: 空配列の場合は何も更新されないこと', async () => {
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:race-1',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: 1_700_000_000_000,
                title: 'A',
                body: 'A',
            });

            await repository.markSentBatch([]);

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows[0].sentAt).toBeNull();
        });
    });

    describe('releaseClaim', () => {
        // RC1 (CONC-01): fetchDueでクレーム済みの行はreleaseClaimでsentAtがnullへ戻り、
        // 再度fetchDueで取得できるようになる（送信失敗時の再試行経路）
        it('RC1: クレーム済みの行のsentAtがnullに戻り再度fetchDueで取得できること', async () => {
            const NOW = 1_700_000_000_000;
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:jra202601010101',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 1_000,
                title: 'タイトル',
                body: '本文',
            });
            const claimed = await repository.fetchDue(NOW, 100);
            expect(claimed).toHaveLength(1);

            await repository.releaseClaim('sub-1:jra202601010101');

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows[0].sentAt).toBeNull();
            const retried = await repository.fetchDue(NOW, 100);
            expect(retried).toHaveLength(1);
        });
    });

    describe('releaseClaimBatch', () => {
        it('RCB1: 指定した全行のsentAtがnullに戻ること', async () => {
            const NOW = 1_700_000_000_000;
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:race-1',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 1_000,
                title: 'A',
                body: 'A',
            });
            await repository.upsert({
                id: 'sub-1:race-2',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010102'),
                fireAtMs: NOW - 1_000,
                title: 'B',
                body: 'B',
            });
            const claimed = await repository.fetchDue(NOW, 100);
            expect(claimed).toHaveLength(2);

            await repository.releaseClaimBatch([
                'sub-1:race-1',
                'sub-1:race-2',
            ]);

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows.every((row) => row.sentAt === null)).toBe(true);
        });

        it('RCB2: 空配列の場合は何も更新されないこと', async () => {
            const NOW = 1_700_000_000_000;
            await insertSubscription('sub-1');
            await repository.upsert({
                id: 'sub-1:race-1',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: NOW - 1_000,
                title: 'A',
                body: 'A',
            });
            await repository.fetchDue(NOW, 100);

            await repository.releaseClaimBatch([]);

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows[0].sentAt).not.toBeNull();
        });
    });

    describe('purgeOld', () => {
        it('PO1/PO2: fireAtMsがbeforeMs未満の行のみ削除されること', async () => {
            await insertSubscription('sub-1');
            const beforeMs = 1_700_000_000_000;
            await repository.upsert({
                id: 'sub-1:old',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010101'),
                fireAtMs: beforeMs - 1_000,
                title: '古い予約',
                body: '本文',
            });
            await repository.upsert({
                id: 'sub-1:new',
                subscriptionId: 'sub-1',
                raceId: validateRaceId('jra202601010102'),
                fireAtMs: beforeMs,
                title: '新しい予約',
                body: '本文',
            });

            await repository.purgeOld(beforeMs);

            const rows = await db.select().from(schema.pushNotificationRequest);
            expect(rows).toHaveLength(1);
            expect(rows[0].title).toBe('新しい予約');
        });
    });
});
