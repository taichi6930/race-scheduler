/**
 * main.ts (executeBatch / executeMultipleBatches) UT
 *
 * executeBatch の正常系フローは既存のコンポーネントテストでカバーされているため、ここでは
 * 複数バッチを順序実行する executeMultipleBatches のループ・集約・ログ経路と、
 * executeBatch の核心である「部分失敗の集約」（main.ts:70-84 付近）を検証する。
 * fetch を空応答にモックし、各バッチが成功（0 件）で完了する経路に加え、
 * 一部の target のみが失敗する経路も URL ごとに応答を切り替えて再現する。
 *
 * ## デシジョンテーブル（executeMultipleBatches / executeBatch）
 *
 * | #    | targets                       | fetch応答                          | 期待結果                                                          |
 * |------|-------------------------------|-------------------------------------|--------------------------------------------------------------------|
 * | M-01 | ['place','race','calendar']   | 全て成功                            | 3 件の結果配列（順序どおり）                                       |
 * | M-02 | ['place']                     | 全て成功                            | 1 件の結果配列                                                     |
 * | M-03 | ['race']                      | /sync/race が 500 エラー            | 例外を投げず failureCount:1・failures[0].id:'race'・理由文字列を含む BatchResult を返す |
 * | M-04 | ['place','race','calendar']   | /sync/race のみ 500 エラー          | race のみ failureCount:1 で失敗、place/calendar は成功結果を返し3件揃う（部分失敗の隔離） |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { executeMultipleBatches } from '../../src/orchestrator';
import type { BatchConfig, BatchExecTarget } from '../../src/types';

interface MockResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
}

/**
 * 全ルート共通のデフォルト成功応答。
 * `/place`（GET, 緩い record 検証）と `/sync/place`・`/sync/race`（UpsertApiResponse）・
 * `/sync`（CalendarUpsertResult、calendar の insertedCount/updatedCount/deletedCount を含む）
 * のいずれのスキーマ検証も通過できるよう、必要なフィールドをすべて含めた形状にしている。
 */
const emptyOkBody = {
    places: [],
    races: [],
    successCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    failureCount: 0,
    failures: [],
};

const emptyOk = (): MockResponse => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(emptyOkBody),
    json: async () => emptyOkBody,
});

const errorResponse = (status: number, body: string): MockResponse => ({
    ok: false,
    status,
    text: async () => body,
    json: async () => ({}),
});

const config: BatchConfig = {
    raceType: RaceType.NAR,
    startDate: '2026-01-01',
    finishDate: '2026-01-05',
};

/**
 * M-03/M-04 用の設定。OVERSEAS はメインAPIを呼ばず月単位でplaceIdを
 * 直接生成するため、race のみを確実に /sync/race まで到達させて
 * エラー応答を発生させられる（NAR 等だとメインAPIが空応答を返した
 * 時点で syncScrapingRaceList 自体が呼ばれず、race のエラー系を
 * 再現できないため）。
 */
const overseasConfig: BatchConfig = {
    raceType: RaceType.OVERSEAS,
    startDate: '2026-01-01',
    finishDate: '2026-01-31',
};

/**
 * リクエスト URL ごとに応答を切り替える fetch spy をインストールする。
 * 未指定パスはデフォルトで成功応答を返す。
 */
const installFetchSpy = (
    routeToStatus: Record<string, { status: number; body: string }> = {},
): ReturnType<typeof spyOn> => {
    const spy = spyOn(globalThis, 'fetch');
    spy.mockImplementation((async (input: string | URL | Request) => {
        const url =
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        const matchedPath = Object.keys(routeToStatus).find((path) =>
            url.includes(path),
        );
        if (matchedPath) {
            const { status, body } = routeToStatus[matchedPath];
            return errorResponse(status, body);
        }
        return emptyOk();
    }) as unknown as typeof fetch);
    return spy;
};

describe('executeMultipleBatches', () => {
    let fetchSpy: ReturnType<typeof spyOn> | undefined;

    beforeEach(() => {
        process.env.SCRAPING_API_URL = 'http://scraping.test';
        process.env.MAIN_API_URL = 'http://main.test';
        process.env.CALENDAR_API_URL = 'http://calendar.test';
    });

    afterEach(() => {
        fetchSpy?.mockRestore();
        fetchSpy = undefined;
        delete process.env.CALENDAR_API_URL;
    });

    it('M-01_3種のtarget_順序どおり3件の結果を返す', async () => {
        // Arrange
        fetchSpy = installFetchSpy();
        const targets: BatchExecTarget[] = ['place', 'race', 'calendar'];

        // Act
        const results = await executeMultipleBatches(targets, config);

        // Assert
        expect(results.map((r) => r.target)).toEqual(targets);
    });

    it('M-02_単一target_1件の結果を返す', async () => {
        // Arrange
        fetchSpy = installFetchSpy();
        const targets: BatchExecTarget[] = ['place'];

        // Act
        const results = await executeMultipleBatches(targets, config);

        // Assert
        expect(results.length).toBe(1);
        expect(results[0]?.target).toBe('place');
    });

    it('M-03_raceのみ実行しsync先がエラー_例外を投げずfailureCount1の結果を返す', async () => {
        // Arrange
        fetchSpy = installFetchSpy({
            '/sync/race': { status: 500, body: 'Internal Server Error' },
        });
        const targets: BatchExecTarget[] = ['race'];

        // Act
        const results = await executeMultipleBatches(targets, overseasConfig);

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0]?.target).toBe('race');
        expect(results[0]?.successCount).toBe(0);
        expect(results[0]?.failureCount).toBe(1);
        expect(results[0]?.failures).toHaveLength(1);
        expect(results[0]?.failures[0]?.id).toBe('race');
        expect(results[0]?.failures[0]?.reason).toContain(
            'returned 500: Internal Server Error',
        );
    });

    it('M-04_3種のtargetでraceのみ失敗_place/calendarは成功結果を維持し3件揃う', async () => {
        // Arrange
        fetchSpy = installFetchSpy({
            '/sync/race': { status: 500, body: 'race sync down' },
        });
        const targets: BatchExecTarget[] = ['place', 'race', 'calendar'];

        // Act
        const results = await executeMultipleBatches(targets, overseasConfig);

        // Assert: 3件揃い、raceのみ失敗が隔離されている
        expect(results).toHaveLength(3);
        const place = results.find((r) => r.target === 'place');
        const race = results.find((r) => r.target === 'race');
        const calendar = results.find((r) => r.target === 'calendar');

        expect(place?.failureCount).toBe(0);
        expect(calendar?.failureCount).toBe(0);

        expect(race?.failureCount).toBe(1);
        expect(race?.successCount).toBe(0);
        expect(race?.failures[0]?.id).toBe('race');
        expect(race?.failures[0]?.reason).toContain('race sync down');
    });
});
