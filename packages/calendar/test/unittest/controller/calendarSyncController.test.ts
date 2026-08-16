/**
 * CalendarSyncController テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件 | 期待結果 | Coverage |
 *----|------|----------|----------|
 * | 1 | 正常なボディ | usecase.syncを呼び200を返す | Line |
 * | 2 | 不正なボディ（raceTypeListなし） | 400・usecase未呼び出し | Branch |
 * | 3 | startDate > finishDate | 400・usecase未呼び出し | Branch |
 * | 4 | usecaseでエラー発生 | 500 | Branch |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';
import { createEmptyCalendarUpsertResult } from '@race-schedule/core';

import { CalendarSyncController } from '../../../src/controller/calendarSyncController';
import type { ICalendarSyncUsecase } from '../../../src/usecase/interface/ICalendarSyncUsecase';

const SYNC_BODY = {
    startDate: '2026-01-01',
    finishDate: '2026-01-31',
    raceTypeList: ['jra'],
};

describe('CalendarSyncController', () => {
    it('#1: 正常なボディでusecase.syncを呼び200を返す', async () => {
        const usecase: ICalendarSyncUsecase = {
            sync: mock(() =>
                Promise.resolve({
                    ...createEmptyCalendarUpsertResult(),
                    insertedCount: 1,
                    successCount: 1,
                }),
            ),
        };
        const controller = new CalendarSyncController(usecase);

        const response = await controller.sync(SYNC_BODY);

        expect(response.status).toBe(200);
        expect(usecase.sync).toHaveBeenCalledTimes(1);
        const body = (await response.json()) as { successCount: number };
        expect(body.successCount).toBe(1);
    });

    it('#2: raceTypeListがない場合は400を返しusecaseは呼ばれない', async () => {
        const usecase: ICalendarSyncUsecase = {
            sync: mock(() =>
                Promise.resolve(createEmptyCalendarUpsertResult()),
            ),
        };
        const controller = new CalendarSyncController(usecase);

        const response = await controller.sync({
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(response.status).toBe(400);
        expect(usecase.sync).not.toHaveBeenCalled();
    });

    it('#3: startDate > finishDateの場合は400を返しusecaseは呼ばれない', async () => {
        const usecase: ICalendarSyncUsecase = {
            sync: mock(() =>
                Promise.resolve(createEmptyCalendarUpsertResult()),
            ),
        };
        const controller = new CalendarSyncController(usecase);

        const response = await controller.sync({
            startDate: '2026-12-31',
            finishDate: '2026-01-01',
            raceTypeList: ['jra'],
        });

        expect(response.status).toBe(400);
        expect(usecase.sync).not.toHaveBeenCalled();
    });

    it('#4: usecaseでエラーが発生した場合は500を返す', async () => {
        const usecase: ICalendarSyncUsecase = {
            sync: mock(() => Promise.reject(new Error('sync error'))),
        };
        const controller = new CalendarSyncController(usecase);

        const response = await controller.sync(SYNC_BODY);

        expect(response.status).toBe(500);
    });
});
