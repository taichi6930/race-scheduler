/**
 * | No | パラメータ例 | Usecase戻り値 | 期待される動作 |
 * |----|----------------|---------------|---------------|
 * | 1  | 正常な全パラメータ | カレンダー1件 | 200+count=1   |
 * | 2  | startDate欠落   | -             | 400           |
 * | 3  | finishDate欠落  | -             | 400           |
 * | 4  | raceTypeList欠落| -             | 400           |
 * | 5  | raceTypeList無効| -             | 400           |
 * | 6  | usecase例外     | -             | 500           |
 * | 9  | flagList: 正常          | CalendarFlagEntity[]1件 | 200+count=1 |
 * | 10 | flagList: usecase例外   | -             | 500           |
 * | 11 | flagAdd: 正常なraceId   | successCount:1 | 200 (D1保存のみ) |
 * | 12 | flagAdd: raceId欠落     | -             | 400           |
 * | 13 | flagAdd: raceId形式不正 | -             | 400           |
 * | 14 | flagAdd: usecase例外    | -             | 500           |
 * | 15 | flagRemove: 正常なraceId | successCount:1 | 200 |
 * | 16 | flagRemove: raceId欠落   | -            | 400 |
 * | 17 | flagRemove: raceId形式不正 | -          | 400 |
 */
import type { CalendarRaceEntity } from '@race-schedule/core';
import { validateRaceId } from '@race-schedule/core';
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';
import { RaceFactory } from '../../../../../tests/shared/factories';
import { CalendarController } from '../../../src/controller/calendarController';
import type { ICalendarUsecase } from '../../../src/usecase/interface/ICalendarUsecase';

interface MockCalendarUsecase {
    fetch: Mock<ICalendarUsecase['fetch']>;
    listFlags: Mock<ICalendarUsecase['listFlags']>;
    addFlag: Mock<ICalendarUsecase['addFlag']>;
    removeFlag: Mock<ICalendarUsecase['removeFlag']>;
}

const createMockUsecase = (
    overrides: Partial<MockCalendarUsecase> = {},
): MockCalendarUsecase => ({
    fetch: mock(() => Promise.resolve([])),
    listFlags: mock(() => Promise.resolve([])),
    addFlag: mock(() => Promise.resolve(undefined)),
    removeFlag: mock(() => Promise.resolve(undefined)),
    ...overrides,
});

interface CountResponseBody {
    count: number;
}

describe('api/controller/CalendarController', () => {
    it('get returns calendars with valid params', async () => {
        const mockData: CalendarRaceEntity[] = [
            { ...RaceFactory.create(), isFlagged: false, isWatched: false },
        ];
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.resolve(mockData)),
        });
        const controller = new CalendarController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(200);
        const body = (await res.json()) as CountResponseBody;
        expect(body.count).toBe(1);
    });

    it('get returns 400 when startDate missing', async () => {
        const usecase = createMockUsecase();
        const controller = new CalendarController(usecase);
        const params = new URLSearchParams({
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(400);
    });

    it('get returns 400 when finishDate missing', async () => {
        const usecase = createMockUsecase();
        const controller = new CalendarController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(400);
    });

    it('get returns 400 when raceTypeList invalid', async () => {
        const usecase = createMockUsecase();
        const controller = new CalendarController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'INVALID',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(400);
    });

    it('get returns 500 when usecase.fetch throws', async () => {
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.reject(new Error('boom'))),
        });
        const controller = new CalendarController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(500);
    });

    interface FlagListResponseBody {
        count: number;
        flags: { raceId: string; label: string }[];
    }

    it('flagList returns flags with count', async () => {
        const usecase = createMockUsecase({
            listFlags: mock(() =>
                Promise.resolve([
                    {
                        raceId: validateRaceId('nar202601010202'),
                        label: '一口:テスト号',
                    },
                ]),
            ),
        });
        const controller = new CalendarController(usecase);
        const res = await controller.flagList();
        expect(res.status).toBe(200);
        const body = (await res.json()) as FlagListResponseBody;
        expect(body.count).toBe(1);
        expect(body.flags[0].raceId).toBe('nar202601010202');
    });

    it('flagList returns 500 when usecase.listFlags throws', async () => {
        const usecase = createMockUsecase({
            listFlags: mock(() => Promise.reject(new Error('boom'))),
        });
        const controller = new CalendarController(usecase);
        const res = await controller.flagList();
        expect(res.status).toBe(500);
    });

    it('flagAdd returns 200 with success counts for a valid raceId (D1保存のみ)', async () => {
        const addFlag = mock(() => Promise.resolve(undefined));
        const usecase = createMockUsecase({ addFlag });
        const controller = new CalendarController(usecase);
        const req = new Request('http://localhost/calendar/flag', {
            method: 'POST',
            body: JSON.stringify({
                raceId: 'nar202601010202',
                label: '一口:テスト号',
            }),
        });
        const res = await controller.flagAdd(req);
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            successCount: number;
            failureCount: number;
        };
        expect(body.successCount).toBe(1);
        expect(body.failureCount).toBe(0);
        expect(addFlag).toHaveBeenCalledWith(
            'nar202601010202',
            '一口:テスト号',
        );
    });

    it('flagAdd returns 400 when raceId is missing', async () => {
        const usecase = createMockUsecase();
        const controller = new CalendarController(usecase);
        const req = new Request('http://localhost/calendar/flag', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await controller.flagAdd(req);
        expect(res.status).toBe(400);
    });

    it('flagAdd returns 400 when raceId format is invalid', async () => {
        const usecase = createMockUsecase();
        const controller = new CalendarController(usecase);
        const req = new Request('http://localhost/calendar/flag', {
            method: 'POST',
            body: JSON.stringify({ raceId: 'not-a-valid-race-id' }),
        });
        const res = await controller.flagAdd(req);
        expect(res.status).toBe(400);
    });

    it('flagAdd returns 500 when usecase.addFlag throws', async () => {
        const usecase = createMockUsecase({
            addFlag: mock(() => Promise.reject(new Error('boom'))),
        });
        const controller = new CalendarController(usecase);
        const req = new Request('http://localhost/calendar/flag', {
            method: 'POST',
            body: JSON.stringify({ raceId: 'nar202601010202' }),
        });
        const res = await controller.flagAdd(req);
        expect(res.status).toBe(500);
    });

    it('flagRemove returns 200 with success counts for a valid raceId', async () => {
        const removeFlag = mock(() => Promise.resolve(undefined));
        const usecase = createMockUsecase({ removeFlag });
        const controller = new CalendarController(usecase);
        const req = new Request('http://localhost/calendar/flag', {
            method: 'DELETE',
            body: JSON.stringify({ raceId: 'nar202601010202' }),
        });
        const res = await controller.flagRemove(req);
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            successCount: number;
            failureCount: number;
            failures: unknown[];
        };
        expect(body.successCount).toBe(1);
        expect(body.failureCount).toBe(0);
        expect(body.failures).toEqual([]);
        expect(removeFlag).toHaveBeenCalledWith('nar202601010202');
    });

    it('flagRemove returns 400 when raceId is missing', async () => {
        const usecase = createMockUsecase();
        const controller = new CalendarController(usecase);
        const req = new Request('http://localhost/calendar/flag', {
            method: 'DELETE',
            body: JSON.stringify({}),
        });
        const res = await controller.flagRemove(req);
        expect(res.status).toBe(400);
    });

    it('flagRemove returns 400 when raceId format is invalid', async () => {
        const usecase = createMockUsecase();
        const controller = new CalendarController(usecase);
        const req = new Request('http://localhost/calendar/flag', {
            method: 'DELETE',
            body: JSON.stringify({ raceId: 'not-a-valid-race-id' }),
        });
        const res = await controller.flagRemove(req);
        expect(res.status).toBe(400);
    });

    it('flagRemove returns 500 when usecase.removeFlag throws', async () => {
        const usecase = createMockUsecase({
            removeFlag: mock(() => Promise.reject(new Error('boom'))),
        });
        const controller = new CalendarController(usecase);
        const req = new Request('http://localhost/calendar/flag', {
            method: 'DELETE',
            body: JSON.stringify({ raceId: 'nar202601010202' }),
        });
        const res = await controller.flagRemove(req);
        expect(res.status).toBe(500);
    });
});
