/**
 * batch/place.ts (runPlaceBatch) UT
 *
 * DTO→Entity変換やメインAPIへのUpsertはscraping Workerの
 * POST /sync/place に委譲されたため、runPlaceBatchは
 * syncScrapingPlaceListの呼び出しと戻り値の受け渡しのみを担う。
 *
 * | #    | テストケース                       | Expected                                              |
 * |------|--------------------------------------|--------------------------------------------------------|
 * | P-01 | 正常系                               | syncScrapingPlaceListに引数が渡り、successCountを返す |
 * | P-02 | successCountが0                      | 0を返す                                                |
 * | P-03 | syncScrapingPlaceListがreject        | runPlaceBatchもrejectで伝播する                        |
 * | P-04 | failureCountが1件以上（OBS-027）     | 握りつぶさず例外を投げる                               |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { runPlaceBatch } from '../../../src/batch/place';
import * as scrapingClient from '../../../src/client/scraping';

describe('runPlaceBatch', () => {
    let syncSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        syncSpy = spyOn(scrapingClient, 'syncScrapingPlaceList');
        syncSpy.mockResolvedValue({
            successCount: 0,
            failureCount: 0,
            failures: [],
        });
    });

    afterEach(() => {
        syncSpy.mockRestore();
    });

    it('P-01_正常系_syncScrapingPlaceListに引数が渡りsuccessCountを返す', async () => {
        syncSpy.mockResolvedValue({
            successCount: 2,
            failureCount: 0,
            failures: [],
        });

        const result = await runPlaceBatch({
            raceType: RaceType.JRA,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(result).toBe(2);
        expect(syncSpy).toHaveBeenCalledWith(
            RaceType.JRA,
            '2026-01-01',
            '2026-01-31',
        );
    });

    it('P-02_successCountが0_0を返す', async () => {
        syncSpy.mockResolvedValue({
            successCount: 0,
            failureCount: 0,
            failures: [],
        });

        const result = await runPlaceBatch({
            raceType: RaceType.NAR,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(result).toBe(0);
    });

    it('P-03_syncScrapingPlaceListがreject_runPlaceBatchもrejectで伝播すること', async () => {
        syncSpy.mockRejectedValue(new Error('Internal Server Error'));

        await expect(
            runPlaceBatch({
                raceType: RaceType.JRA,
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
            }),
        ).rejects.toThrow('Internal Server Error');
    });

    it('P-04_failureCountが1件以上_握りつぶさず例外を投げること', async () => {
        syncSpy.mockResolvedValue({
            successCount: 3,
            failureCount: 1,
            failures: [{ db: 'main', id: 'place-x', reason: 'boom' }],
        });

        await expect(
            runPlaceBatch({
                raceType: RaceType.JRA,
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
            }),
        ).rejects.toThrow('Place sync failed for 1 item(s): place-x: boom');
    });
});
