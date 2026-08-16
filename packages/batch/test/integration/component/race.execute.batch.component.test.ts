/**
 * Batch Module Integration Test
 * テスト対象: executeBatch('race', ...) （main.ts の入り口）から
 * runRaceBatch（batch/race.ts）→ buildPlaceInfoMap／syncScrapingRaceList
 * （client/main.ts・client/scraping.ts）までの実コードを通した振る舞い。
 *
 * 旧テストは実API依存のため `toBeDefined()`/`typeof x==='number'`/
 * `Array.isArray()` に終始し、成否・具体値を一切検証できていなかった。
 * 本ファイルは `fetchMainPlaceList`/`syncScrapingRaceList`（クライアント境界）
 * のみを spy して決定的にし、`executeBatch` の集約ロジック（成功反映・
 * エラー捕捉・失敗詳細化）を実コードパスで検証する。
 *
 * ## シナリオテーブル
 *
 * | #    | シナリオ                                                          | 期待                                                                 |
 * |------|----------------------------------------------------------------------|--------------------------------------------------------------------------|
 * | RB-1 | メインAPI成功(1件・KEIRIN) → scrapingへ委譲しsuccessCount反映         | executeBatch が successCount=3, failureCount=0, failures=[] を返す      |
 * | RB-2 | メインAPI throw（KEIRIN・buildPlaceInfoMapが握り潰し仕様で空map）     | successCount=0, failureCount=0（syncScrapingRaceList は呼ばれない）     |
 * | RB-3 | メインAPI成功(KEIRIN)だが scraping 側 syncScrapingRaceList が throw   | successCount=0, failureCount=1, failures=[{id:'race', reason: 障害理由を含む}] |
 * | RB-4 | 冪等性 - 同一設定・同一モック応答で2回実行                             | 2回とも同一の successCount/failureCount/failures を返す                |
 * | RB-5 | OVERSEAS はメインAPIを呼ばず月単位生成でscrapingへ委譲                | fetchMainPlaceList 未呼び出し・syncScrapingRaceList の successCount がそのまま反映 |
 * | RB-6 | NARはメインAPIを呼ばず期間指定でscrapingへ直接委譲                    | fetchMainPlaceList・syncScrapingRaceList いずれも未呼び出し、syncScrapingNarRaceByDateRangeのsuccessCountが反映 |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import * as mainClient from '../../../src/client/main';
import * as scrapingClient from '../../../src/client/scraping';
import { executeBatch } from '../../../src/orchestrator';
import type { BatchConfig } from '../../../src/types';

describe('コンポーネントテスト: Batch - executeBatch Race Processing', () => {
    let fetchMainPlaceListSpy: ReturnType<typeof spyOn>;
    let syncScrapingRaceListSpy: ReturnType<typeof spyOn>;
    let syncScrapingNarRaceByDateRangeSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        process.env.SCRAPING_API_URL = 'http://scraping.test';
        process.env.MAIN_API_URL = 'http://main.test';
        fetchMainPlaceListSpy = spyOn(mainClient, 'fetchMainPlaceList');
        syncScrapingRaceListSpy = spyOn(scrapingClient, 'syncScrapingRaceList');
        syncScrapingNarRaceByDateRangeSpy = spyOn(
            scrapingClient,
            'syncScrapingNarRaceByDateRange',
        );
    });

    afterEach(() => {
        fetchMainPlaceListSpy.mockRestore();
        syncScrapingRaceListSpy.mockRestore();
        syncScrapingNarRaceByDateRangeSpy.mockRestore();
        delete process.env.SCRAPING_API_URL;
        delete process.env.MAIN_API_URL;
    });

    it('RB-1_メインAPI成功_scrapingへ委譲しsuccessCountが反映される', async () => {
        // Arrange
        fetchMainPlaceListSpy.mockResolvedValue([
            {
                placeId: 'keirin2026050211',
                raceType: RaceType.KEIRIN,
                datetime: '2026-05-02T00:00:00+09:00',
                raceCourse: '函館',
                locationCode: '11',
                placeGrade: 'GⅠ',
            },
        ]);
        syncScrapingRaceListSpy.mockResolvedValue({
            successCount: 3,
            failureCount: 0,
            failures: [],
        });
        const config: BatchConfig = {
            raceType: RaceType.KEIRIN,
            startDate: '2026-05-02',
            finishDate: '2026-05-02',
        };

        // Act
        const result = await executeBatch('race', config);

        // Assert
        expect(result.target).toBe('race');
        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
        expect(result.failures).toEqual([]);
        expect(syncScrapingRaceListSpy).toHaveBeenCalledTimes(1);
        expect(syncScrapingRaceListSpy.mock.calls[0][0]).toEqual([
            'keirin2026050211',
        ]);
    });

    it('RB-2_メインAPIがthrow_空mapとして握り潰されsuccessCount0かつfailureCount0', async () => {
        // Arrange
        fetchMainPlaceListSpy.mockRejectedValue(
            new Error('main API unavailable'),
        );
        const config: BatchConfig = {
            raceType: RaceType.KEIRIN,
            startDate: '2026-05-01',
            finishDate: '2026-05-02',
        };

        // Act
        const result = await executeBatch('race', config);

        // Assert: buildPlaceInfoMap の握り潰し仕様どおり、executeBatch からは
        // 失敗として観測されない（0件成功・0件失敗）
        expect(result.successCount).toBe(0);
        expect(result.failureCount).toBe(0);
        expect(result.failures).toEqual([]);
        expect(syncScrapingRaceListSpy).not.toHaveBeenCalled();
    });

    it('RB-3_メインAPI成功だがscraping側がthrow_failureCount1で理由が伝播する', async () => {
        // Arrange
        fetchMainPlaceListSpy.mockResolvedValue([
            {
                placeId: 'keirin2026050211',
                raceType: RaceType.KEIRIN,
                datetime: '2026-05-02T00:00:00+09:00',
                raceCourse: '函館',
                locationCode: '11',
                placeGrade: 'GⅠ',
            },
        ]);
        syncScrapingRaceListSpy.mockRejectedValue(
            new Error('scraping sync failed: 503'),
        );
        const config: BatchConfig = {
            raceType: RaceType.KEIRIN,
            startDate: '2026-05-02',
            finishDate: '2026-05-02',
        };

        // Act
        const result = await executeBatch('race', config);

        // Assert
        expect(result.successCount).toBe(0);
        expect(result.failureCount).toBe(1);
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0]?.id).toBe('race');
        expect(result.failures[0]?.reason).toContain(
            'scraping sync failed: 503',
        );
    });

    it('RB-4_冪等性_同一設定と同一モック応答で2回実行しても同一結果を返す', async () => {
        // Arrange
        fetchMainPlaceListSpy.mockResolvedValue([
            {
                placeId: 'keirin2026050211',
                raceType: RaceType.KEIRIN,
                datetime: '2026-05-02T00:00:00+09:00',
                raceCourse: '函館',
                locationCode: '11',
                placeGrade: 'GⅠ',
            },
        ]);
        syncScrapingRaceListSpy.mockResolvedValue({
            successCount: 2,
            failureCount: 0,
            failures: [],
        });
        const config: BatchConfig = {
            raceType: RaceType.KEIRIN,
            startDate: '2026-05-02',
            finishDate: '2026-05-02',
        };

        // Act
        const result1 = await executeBatch('race', config);
        const result2 = await executeBatch('race', config);

        // Assert
        expect(result1.successCount).toBe(2);
        expect(result2.successCount).toBe(2);
        expect(result1.failureCount).toBe(result2.failureCount);
        expect(result1.failures).toEqual(result2.failures);
        expect(syncScrapingRaceListSpy).toHaveBeenCalledTimes(2);
    });

    it('RB-5_OVERSEAS_メインAPIは呼ばれず月単位生成でsyncのsuccessCountが反映される', async () => {
        // Arrange
        syncScrapingRaceListSpy.mockResolvedValue({
            successCount: 5,
            failureCount: 0,
            failures: [],
        });
        const config: BatchConfig = {
            raceType: RaceType.OVERSEAS,
            startDate: '2026-01-01',
            finishDate: '2026-03-31',
        };

        // Act
        const result = await executeBatch('race', config);

        // Assert
        expect(fetchMainPlaceListSpy).not.toHaveBeenCalled();
        expect(result.successCount).toBe(5);
        expect(result.failureCount).toBe(0);
        const placeIdList = syncScrapingRaceListSpy.mock
            .calls[0][0] as string[];
        expect(placeIdList.length).toBe(3);
    });

    it('RB-6_NAR_メインAPIもplaceIdList指定モードも呼ばれず期間指定で直接委譲される', async () => {
        // Arrange
        syncScrapingNarRaceByDateRangeSpy.mockResolvedValue({
            successCount: 7,
            failureCount: 0,
            failures: [],
        });
        const config: BatchConfig = {
            raceType: RaceType.NAR,
            startDate: '2026-05-01',
            finishDate: '2026-05-31',
        };

        // Act
        const result = await executeBatch('race', config);

        // Assert
        expect(fetchMainPlaceListSpy).not.toHaveBeenCalled();
        expect(syncScrapingRaceListSpy).not.toHaveBeenCalled();
        expect(syncScrapingNarRaceByDateRangeSpy).toHaveBeenCalledWith(
            '2026-05-01',
            '2026-05-31',
        );
        expect(result.successCount).toBe(7);
        expect(result.failureCount).toBe(0);
    });
});
