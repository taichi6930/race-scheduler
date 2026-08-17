/**
 * resolveTodayJst / runDataFreshnessCheck のテスト
 *
 * @spec なし（CICD-121: health-check-data-freshness.ymlのWorker側移行）
 *
 * ## デシジョンテーブル（resolveTodayJst）
 *
 * | #    | UTC時刻                    | 期待JST日付   |
 * |------|------------------------------|----------------|
 * | T-01 | 2026-08-01T15:00:00Z（+9h=翌日0時） | 2026-08-02 |
 * | T-02 | 2026-08-01T00:00:00Z（+9h=同日9時） | 2026-08-01 |
 *
 * ## デシジョンテーブル（runDataFreshnessCheck）
 *
 * | #    | GITHUB_TOKEN | RaceUsecase.fetch  | 期待挙動                                             |
 * |------|--------------|--------------------|--------------------------------------------------------|
 * | T-03 | 未設定       | -                  | 何もせずreturn（RaceUsecase.fetchも呼ばれない）        |
 * | T-04 | 設定         | 0件                | GitHub Issue作成APIが呼ばれる（fetchがPOST /issuesを1回叩く） |
 * | T-05 | 設定         | 1件以上            | GitHub APIは呼ばれない（正常）                          |
 * | T-06 | 設定         | 例外を投げる        | catchされ警告ログ、GitHub APIは呼ばれない               |
 *
 * ## デシジョンテーブル（toQueryDate、QJST-07回帰）
 *
 * | #    | dateJst      | 期待挙動                                                    |
 * |------|--------------|---------------------------------------------------------------|
 * | T-07 | '2026-08-01' | JST深夜0時（=UTC前日15時）を表すDateになる（UTC深夜0時ではない） |
 * | T-08 | '2026-08-01' | runDataFreshnessCheckがfetchへ渡すstartDateがJST深夜0時になる |
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import { DI_TOKENS, EnvStore } from '@race-schedule/core';
import 'reflect-metadata';
import { container } from 'tsyringe';

import {
    resolveTodayJst,
    runDataFreshnessCheck,
    toQueryDate,
} from '../../../src/utility/dataFreshnessCheck';

interface FakeResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
}
type FetchHandler = (
    url: string,
    init?: { method?: string },
) => Promise<FakeResponse>;

const okJson = (data: unknown): FakeResponse => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
});

const setFetch = (
    handler: FetchHandler,
): { calls: { url: string; init?: { method?: string } }[] } => {
    const calls: { url: string; init?: { method?: string } }[] = [];
    const fn = mock((url: string, init?: { method?: string }) => {
        calls.push({ url, init });
        return handler(url, init);
    });
    globalThis.fetch = fn as unknown as typeof globalThis.fetch;
    return { calls };
};

const MINIMAL_ENV = {
    JRA_CALENDAR_ID: 'mock',
    NAR_CALENDAR_ID: 'mock',
    WORLD_CALENDAR_ID: 'mock',
    KEIRIN_CALENDAR_ID: 'mock',
    AUTORACE_CALENDAR_ID: 'mock',
    BOATRACE_CALENDAR_ID: 'mock',
    GOOGLE_CLIENT_EMAIL: 'mock@example.com',
    GOOGLE_PRIVATE_KEY: 'mock',
    R2_BUCKET: {},
};

describe('resolveTodayJst', () => {
    it('T-01: UTC 15:00は日付が繰り上がりJSTで翌日になる', () => {
        expect(resolveTodayJst(new Date('2026-08-01T15:00:00Z'))).toBe(
            '2026-08-02',
        );
    });

    it('T-02: UTC 00:00はJSTで同日9時のため日付は変わらない', () => {
        expect(resolveTodayJst(new Date('2026-08-01T00:00:00Z'))).toBe(
            '2026-08-01',
        );
    });
});

describe('toQueryDate', () => {
    it('T-07: JST深夜0時（UTC前日15時）を表すDateを返すこと', () => {
        expect(toQueryDate('2026-08-01').toISOString()).toBe(
            '2026-07-31T15:00:00.000Z',
        );
    });
});

describe('runDataFreshnessCheck', () => {
    interface MockRaceUsecase {
        fetch: (params: unknown) => Promise<unknown[]>;
    }

    afterEach(() => {
        container.clearInstances();
        EnvStore.reset();
    });

    it('T-03: GITHUB_TOKEN未設定ならRaceUsecase.fetchを呼ばずreturnする', async () => {
        EnvStore.setEnv({ ...MINIMAL_ENV } as never, []);
        const fetchSpy = mock(() => Promise.resolve([]));
        container.register<MockRaceUsecase>(DI_TOKENS.RaceUsecase, {
            useValue: { fetch: fetchSpy },
        });

        await runDataFreshnessCheck(new Date('2026-08-01T05:00:00Z'));

        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('T-04: 0件ならGitHub Issue作成APIが呼ばれる', async () => {
        EnvStore.setEnv({ ...MINIMAL_ENV, GITHUB_TOKEN: 'token' } as never, []);
        container.register<MockRaceUsecase>(DI_TOKENS.RaceUsecase, {
            useValue: { fetch: () => Promise.resolve([]) },
        });
        const { calls } = setFetch((_url, init) => {
            // 1回目: fetchAllOpenIssues（GET、既存Issueなし） / 2回目: createIssue（POST）
            if (init?.method === 'POST') {
                return Promise.resolve(okJson({ number: 99 }));
            }
            return Promise.resolve(okJson([]));
        });

        await runDataFreshnessCheck(new Date('2026-08-01T05:00:00Z'));

        const createCall = calls.find((c) => c.init?.method === 'POST');
        expect(createCall).toBeDefined();
        expect(createCall?.url).toContain('/issues');
    });

    it('T-05: 1件以上かつ既存Issueが無ければGitHub Issueへの書き込みは行われない', async () => {
        // syncDataFreshnessIssueはClose対象Issueの有無を確認するため
        // fetchAllOpenIssues（GET）自体は呼ぶ。ここでは「書き込み系
        // （POST/PATCH）が発生しないこと」を検証する（既存Issueが無い＝
        // Closeするものも無いため）。
        EnvStore.setEnv({ ...MINIMAL_ENV, GITHUB_TOKEN: 'token' } as never, []);
        container.register<MockRaceUsecase>(DI_TOKENS.RaceUsecase, {
            useValue: { fetch: () => Promise.resolve([{ id: 'race-1' }]) },
        });
        const { calls } = setFetch(() => Promise.resolve(okJson([])));

        await runDataFreshnessCheck(new Date('2026-08-01T05:00:00Z'));

        const writeCalls = calls.filter((c) => c.init?.method !== undefined);
        expect(writeCalls).toHaveLength(0);
    });

    it('T-08: fetchへ渡すstartDateがJST深夜0時になること', async () => {
        EnvStore.setEnv({ ...MINIMAL_ENV, GITHUB_TOKEN: 'token' } as never, []);
        const fetchSpy = mock((_params: unknown) => Promise.resolve([]));
        container.register<MockRaceUsecase>(DI_TOKENS.RaceUsecase, {
            useValue: { fetch: fetchSpy },
        });
        setFetch(() => Promise.resolve(okJson([])));

        // UTC 05:00 = JST 14:00（当日）
        await runDataFreshnessCheck(new Date('2026-08-01T05:00:00Z'));

        const params = fetchSpy.mock.calls[0][0] as {
            startDate: Date;
            finishDate: Date;
        };
        expect(params.startDate.toISOString()).toBe('2026-07-31T15:00:00.000Z');
    });

    it('T-06: RaceUsecase.fetchが例外を投げてもスローせずGitHub APIは呼ばれない', async () => {
        EnvStore.setEnv({ ...MINIMAL_ENV, GITHUB_TOKEN: 'token' } as never, []);
        container.register<MockRaceUsecase>(DI_TOKENS.RaceUsecase, {
            useValue: {
                fetch: () => Promise.reject(new Error('db error')),
            },
        });
        const { calls } = setFetch(() => Promise.resolve(okJson([])));

        await runDataFreshnessCheck(new Date('2026-08-01T05:00:00Z'));

        expect(calls).toHaveLength(0);
    });
});
