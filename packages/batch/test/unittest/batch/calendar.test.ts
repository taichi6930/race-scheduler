/**
 * batch/calendar.ts (runCalendarBatch) UT
 *
 * | #    | テストケース        | Expected                                              |
 * |------|--------------------|--------------------------------------------------------|
 * | C-01 | 正常パス             | syncCalendar が finishDate+1 で呼ばれ、合計を返す       |
 * | C-02 | API エラー          | Error がバブルアップ                                    |
 * | C-03 | 部分失敗            | failureCount>0 の場合、成功件数を握り潰さず Error を投げる |
 * | C-04 | 年またぎ（PERF-185） | finishDate=12/31 の場合、syncCalendarへ翌年1/1が渡される |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { runCalendarBatch } from '../../../src/batch/calendar';
import * as calendarClient from '../../../src/client/calendar';

describe('runCalendarBatch', () => {
    let syncSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        syncSpy = spyOn(calendarClient, 'syncCalendar');
    });

    afterEach(() => {
        syncSpy.mockRestore();
    });

    it('C-01_正常パス_syncCalendarへraceTypeと日付を渡し合計を返す', async () => {
        syncSpy.mockResolvedValue({
            successCount: 5,
            insertedCount: 3,
            updatedCount: 2,
            deletedCount: 0,
            failureCount: 0,
            failures: [],
        });

        const result = await runCalendarBatch({
            raceType: RaceType.JRA,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(result).toBe(5);
        expect(syncSpy).toHaveBeenCalledWith(
            [RaceType.JRA],
            '2026-01-01',
            // finishDate に +1 日加算される
            '2026-02-01',
        );
    });

    it('C-02_APIエラー_Errorがバブルアップする', async () => {
        syncSpy.mockRejectedValue(new Error('Internal Server Error'));

        await expect(
            runCalendarBatch({
                raceType: RaceType.JRA,
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
            }),
        ).rejects.toThrow();
    });

    it('C-04_年またぎ_finishDateが12/31の場合syncCalendarへ翌年1/1が渡される', async () => {
        syncSpy.mockResolvedValue({
            successCount: 1,
            insertedCount: 1,
            updatedCount: 0,
            deletedCount: 0,
            failureCount: 0,
            failures: [],
        });

        await runCalendarBatch({
            raceType: RaceType.JRA,
            startDate: '2025-12-01',
            finishDate: '2025-12-31',
        });

        expect(syncSpy).toHaveBeenCalledWith(
            [RaceType.JRA],
            '2025-12-01',
            '2026-01-01',
        );
    });

    it('C-03_部分失敗_failureCountが0より大きい場合Errorを投げる', async () => {
        syncSpy.mockResolvedValue({
            successCount: 0,
            insertedCount: 0,
            updatedCount: 0,
            deletedCount: 0,
            failureCount: 1,
            failures: [
                {
                    id: 'jra',
                    reason: 'Invalid or empty calendarId for raceType: jra',
                },
            ],
        });

        await expect(
            runCalendarBatch({
                raceType: RaceType.JRA,
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
            }),
        ).rejects.toThrow(/Invalid or empty calendarId for raceType: jra/);
    });
});
