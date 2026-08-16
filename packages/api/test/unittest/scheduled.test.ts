/**
 * scheduled.test.ts - Cloudflare `scheduled` ハンドラのテスト
 *
 * このリポジトリ初の `scheduled` ハンドラ（web-push-design.md §5）。
 * 前例が無いため、実DI（in-memory D1）+ PushUsecase.dispatchDue への
 * spyOn で「期限到来予約の配信経路が疎通すること」を検証する。
 *
 * ## デシジョンテーブル
 *
 * | # | event.cron                | DB状態                              | 期待値 |
 * |---|----------------------------|--------------------------------------|--------|
 * | 1 | 未設定                     | 期限到来の予約なし                    | スローせず完了し、PushUsecase.dispatchDueが1回呼ばれる |
 * | 2 | 未設定                     | 期限到来の予約が1件（VAPID未設定）      | スローせず完了し、送信が試行される（sentAtはnullのまま＝失敗として処理） |
 * | 3 | データ鮮度チェック用cron   | -                                     | PushUsecase.dispatchDueは呼ばれず、データ鮮度チェック（CICD-121）と未使用購読パージ（SEC-053）に分岐する |
 * | 4 | 未設定                     | PushUsecase.dispatchDueがthrow         | スローせずappLogger.errorでログされ完了する（CONC-07） |
 * | 5 | エラー監視（全対象）用cron | -                                     | PushUsecase.dispatchDueは呼ばれず、エラー監視（CICD-122）に分岐する |
 * | 6 | エラー監視（apiのみ）用cron| -                                     | PushUsecase.dispatchDueは呼ばれず、エラー監視（CICD-122）に分岐する |
 * | 7 | Uptime監視用cron           | -                                     | PushUsecase.dispatchDueは呼ばれず、Uptime監視に分岐する |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { appLogger, type CloudFlareEnv } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import * as schema from '../../src/db/schema';
import { scheduled } from '../../src/scheduled';
import { PushUsecase } from '../../src/usecase/implement/pushUsecase';
import { createInMemoryD1Database } from '../common/inMemoryD1';
import { setupGlobalMocks } from '../common/setupGlobalMocks';

/**
 * `scheduled` に渡すモック環境変数。
 * `ensureDIInitialized` が API_REQUIRED_KEYS のバリデーションを通過するために必要
 * （test/unittest/router.test.ts の buildMockHonoEnv と同じ方針）。
 * @param db - EnvStore.env.DB へ設定する D1Database
 */
const buildMockHonoEnv = (db: D1Database) => ({
    JRA_CALENDAR_ID: 'mock-jra-calendar-id',
    NAR_CALENDAR_ID: 'mock-nar-calendar-id',
    WORLD_CALENDAR_ID: 'mock-world-calendar-id',
    KEIRIN_CALENDAR_ID: 'mock-keirin-calendar-id',
    AUTORACE_CALENDAR_ID: 'mock-autorace-calendar-id',
    BOATRACE_CALENDAR_ID: 'mock-boatrace-calendar-id',
    GOOGLE_CLIENT_EMAIL: 'mock@example.com',
    GOOGLE_PRIVATE_KEY:
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAtestKeyForUnitTest\n-----END RSA PRIVATE KEY-----',
    USE_IN_MEMORY_DB: 'true',
    DB: db,
    R2_BUCKET: {} as unknown as R2Bucket,
});

describe('scheduled', () => {
    let db: DrizzleD1Database<typeof schema>;
    let env: CloudFlareEnv;

    beforeEach(() => {
        const d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        env = buildMockHonoEnv(d1) as unknown as CloudFlareEnv;
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('1: 期限到来の予約が無い場合はスローせず完了しdispatchDueが呼ばれること', async () => {
        const spy = spyOn(PushUsecase.prototype, 'dispatchDue');

        await scheduled({} as Parameters<typeof scheduled>[0], env);

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('2: 期限到来の予約が1件ある場合は送信が試行されること（VAPID未設定のため失敗のまま）', async () => {
        await db.insert(schema.pushSubscription).values({
            id: 'sub-1',
            endpoint: 'https://push.example.com/subscription/1',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
        });
        await db.insert(schema.pushNotificationRequest).values({
            id: 'sub-1:jra202601010101',
            subscriptionId: 'sub-1',
            raceId: 'jra202601010101',
            fireAtMs: Date.now() - 1_000,
            title: 'タイトル',
            body: '本文',
        });

        await scheduled({} as Parameters<typeof scheduled>[0], env);

        const rows = await db.select().from(schema.pushNotificationRequest);
        expect(rows).toHaveLength(1);
        // VAPID未設定のためWebPushGateway.sendが失敗し、sentAtは更新されない
        expect(rows[0].sentAt).toBeNull();
    });

    it('3: event.cronがデータ鮮度チェック用cronならPushUsecase.dispatchDueは呼ばれずpurgeStaleSubscriptionsが呼ばれる（SEC-053）', async () => {
        // spyOnは同一prototypeメソッドへの再spyで既存の呼び出し回数を引き継ぐため
        // （bun:testの挙動）、絶対値ではなく「この呼び出し前後で増えないこと」を見る。
        const dispatchDueSpy = spyOn(PushUsecase.prototype, 'dispatchDue');
        const callsBefore = dispatchDueSpy.mock.calls.length;
        const purgeStaleSpy = spyOn(
            PushUsecase.prototype,
            'purgeStaleSubscriptions',
        );

        // scheduled.ts の DATA_FRESHNESS_CRON と完全に一致させること
        // （wrangler.toml の [env.production.triggers] crons の2つ目の値と同じ）。
        await scheduled(
            { cron: '0 5 * * *' } as Parameters<typeof scheduled>[0],
            env,
        );

        expect(dispatchDueSpy.mock.calls.length).toBe(callsBefore);
        expect(purgeStaleSpy).toHaveBeenCalledTimes(1);
    });

    it('4: PushUsecase.dispatchDueがthrowしてもスローせずappLogger.errorでログされること（CONC-07）', async () => {
        const dispatchDueSpy = spyOn(
            PushUsecase.prototype,
            'dispatchDue',
        ).mockImplementation(() => {
            throw new Error('dispatch failed');
        });
        const errorSpy = spyOn(appLogger, 'error').mockImplementation(() => {});

        await scheduled({} as Parameters<typeof scheduled>[0], env);

        expect(errorSpy).toHaveBeenCalledWith(
            'Web Push dispatch (scheduled) failed',
            expect.any(Error),
        );

        errorSpy.mockRestore();
        dispatchDueSpy.mockRestore();
    });

    it('5: event.cronがエラー監視（全対象）用cronならPushUsecase.dispatchDueは呼ばれない', async () => {
        const spy = spyOn(PushUsecase.prototype, 'dispatchDue');
        const callsBefore = spy.mock.calls.length;

        // scheduled.ts の ERROR_MONITOR_FULL_CRON と完全に一致させること
        // （wrangler.toml の [env.production.triggers] crons の3つ目の値と同じ）。
        await scheduled(
            { cron: '0 * * * *' } as Parameters<typeof scheduled>[0],
            env,
        );

        expect(spy.mock.calls.length).toBe(callsBefore);
    });

    it('6: event.cronがエラー監視（apiのみ）用cronならPushUsecase.dispatchDueは呼ばれない', async () => {
        const spy = spyOn(PushUsecase.prototype, 'dispatchDue');
        const callsBefore = spy.mock.calls.length;

        // scheduled.ts の ERROR_MONITOR_API_ONLY_CRON と完全に一致させること
        // （wrangler.toml の [env.production.triggers] crons の4つ目の値と同じ）。
        await scheduled(
            { cron: '30 * * * *' } as Parameters<typeof scheduled>[0],
            env,
        );

        expect(spy.mock.calls.length).toBe(callsBefore);
    });

    it('7: event.cronがUptime監視用cronならPushUsecase.dispatchDueは呼ばれない', async () => {
        const spy = spyOn(PushUsecase.prototype, 'dispatchDue');
        const callsBefore = spy.mock.calls.length;

        // scheduled.ts の UPTIME_CHECK_CRON と完全に一致させること
        // （wrangler.toml の [env.production.triggers] crons の5つ目の値と同じ）。
        await scheduled(
            { cron: '*/15 * * * *' } as Parameters<typeof scheduled>[0],
            env,
        );

        expect(spy.mock.calls.length).toBe(callsBefore);
    });
});
