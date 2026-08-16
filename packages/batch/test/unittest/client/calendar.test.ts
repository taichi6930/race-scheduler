/**
 * calendar Worker クライアント テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | Function     | 条件                  | Expected                          | Coverage |
 * |------|--------------|-----------------------|-------------------------------------|----------|
 * | C-01 | syncCalendar | raceTypeListが複数     | POST /sync にJSONボディでリクエスト | Line     |
 * | C-02 | syncCalendar | 正常系                 | CalendarUpsertResultを返す         | Line     |
 * | C-03 | syncCalendar | SERVICE_AUTH_TOKEN設定済み | X-Service-Auth-Tokenヘッダが付与される | Line |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { syncCalendar } from '../../../src/client/calendar';
import * as httpModule from '../../../src/client/http';

describe('syncCalendar', () => {
    let fetchSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        process.env.CALENDAR_API_URL = 'http://calendar.test';
        fetchSpy = spyOn(httpModule, 'fetchWithTimeout');
        fetchSpy.mockResolvedValue({
            successCount: 3,
            insertedCount: 2,
            updatedCount: 1,
            deletedCount: 0,
            failureCount: 0,
            failures: [],
        });
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        delete process.env.CALENDAR_API_URL;
        delete process.env.SERVICE_AUTH_TOKEN;
    });

    it('C-01_raceTypeListが複数_POST /sync にJSONボディでリクエストする', async () => {
        const raceTypeList = ['jra', 'nar', 'keirin'];

        await syncCalendar(raceTypeList, '2024-04-01', '2024-04-30');

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const urlArg = fetchSpy.mock.calls[0][0] as URL;
        expect(urlArg.pathname).toBe('/sync');
        const options = fetchSpy.mock.calls[0][2] as RequestInit;
        expect(options.method).toBe('POST');
        const body = JSON.parse(options.body as string) as {
            raceTypeList: string[];
            startDate: string;
            finishDate: string;
        };
        expect(body.raceTypeList).toEqual(raceTypeList);
        expect(body.startDate).toBe('2024-04-01');
        expect(body.finishDate).toBe('2024-04-30');
    });

    it('C-03_SERVICE_AUTH_TOKEN設定済み_X-Service-Auth-Tokenヘッダが付与される', async () => {
        process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';

        await syncCalendar(['jra'], '2024-04-01', '2024-04-30');

        const options = fetchSpy.mock.calls[0][2] as RequestInit;
        const headers = options.headers as Record<string, string>;
        expect(headers['X-Service-Auth-Token']).toBe('test-service-auth-token');
    });

    it('C-02_正常系_CalendarUpsertResultを返す', async () => {
        const result = await syncCalendar(['jra'], '2024-04-01', '2024-04-30');

        expect(result.successCount).toBe(3);
        expect(result.insertedCount).toBe(2);
        expect(result.updatedCount).toBe(1);
    });
});
