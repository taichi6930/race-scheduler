/**
 * scraping API クライアント テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | Function               | 入力                              | Expected                                    | Coverage |
 * |------|------------------------|-----------------------------------|----------------------------------------------|----------|
 * | S-01 | syncScrapingPlaceList  | raceType/startDate/finishDate     | POST /sync/place にJSONボディでリクエスト     | Line     |
 * | S-02 | syncScrapingPlaceList  | 正常系                            | UpsertApiResponseを返す                      | Line     |
 * | S-03 | syncScrapingRaceList   | placeIdList/placeHeldDaysMap      | POST /sync/race にJSONボディでリクエスト      | Line     |
 * | S-04 | syncScrapingRaceList   | placeHeldDaysMap省略              | 空オブジェクトとして送信される                | Branch   |
 * | S-05 | syncScrapingPlaceList  | SERVICE_AUTH_TOKEN設定済み        | X-Service-Auth-Tokenヘッダが付与される        | Line     |
 * | S-06 | syncScrapingRaceList   | placeIdListがデフォルトチャンクサイズ(10)超 | チャンク毎に複数回POSTされる       | Branch   |
 * | S-07 | syncScrapingRaceList   | 各チャンクのplaceHeldDaysMap       | チャンクに含まれるIDのみへ絞り込まれる         | Line     |
 * | S-08 | syncScrapingRaceList   | チャンク分割時の各レスポンス       | successCount/failureCount/failuresが集計される | Line     |
 * | S-09 | syncScrapingRaceList   | SCRAPING_RACE_SYNC_CHUNK_SIZE=2   | 2件ずつのチャンクに分割される                  | Branch   |
 * | S-10 | syncScrapingRaceList   | SCRAPING_RACE_SYNC_CHUNK_SIZE=0/abc | デフォルト(10)にフォールバックする           | Branch   |
 * | S-11 | syncScrapingRaceList   | placeIdListがちょうどデフォルトチャンクサイズ(10) | 1回のみPOSTされる（チャンク分割されない） | Branch   |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import * as httpModule from '../../../src/client/http';
import {
    syncScrapingPlaceList,
    syncScrapingRaceList,
} from '../../../src/client/scraping';

describe('scraping API client', () => {
    let fetchSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        process.env.SCRAPING_API_URL = 'http://scraping.test';
        process.env.MAIN_API_URL = 'http://main.test';
        fetchSpy = spyOn(httpModule, 'fetchWithTimeout');
        fetchSpy.mockResolvedValue({
            successCount: 0,
            failureCount: 0,
            failures: [],
        });
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        delete process.env.SCRAPING_API_URL;
        delete process.env.MAIN_API_URL;
        delete process.env.SERVICE_AUTH_TOKEN;
        delete process.env.SCRAPING_RACE_SYNC_CHUNK_SIZE;
    });

    describe('syncScrapingPlaceList', () => {
        it('S-01_POST /sync/place に正しいJSONボディでリクエストする', async () => {
            // Act
            await syncScrapingPlaceList('jra', '2024-04-01', '2024-04-30');

            // Assert
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const urlArg = fetchSpy.mock.calls[0][0] as URL;
            expect(urlArg.pathname).toBe('/sync/place');
            const options = fetchSpy.mock.calls[0][2] as RequestInit;
            expect(options.method).toBe('POST');
            const body = JSON.parse(options.body as string) as {
                startDate: string;
                finishDate: string;
                raceTypeList: string[];
            };
            expect(body).toEqual({
                startDate: '2024-04-01',
                finishDate: '2024-04-30',
                raceTypeList: ['jra'],
            });
        });

        it('S-05_SERVICE_AUTH_TOKEN設定済み_X-Service-Auth-Tokenヘッダが付与される', async () => {
            // Arrange
            process.env.SERVICE_AUTH_TOKEN = 'test-service-auth-token';

            // Act
            await syncScrapingPlaceList('jra', '2024-04-01', '2024-04-30');

            // Assert
            const options = fetchSpy.mock.calls[0][2] as RequestInit;
            const headers = options.headers as Record<string, string>;
            expect(headers['X-Service-Auth-Token']).toBe(
                'test-service-auth-token',
            );
        });

        it('S-02_正常系_UpsertApiResponseを返す', async () => {
            // Arrange
            fetchSpy.mockResolvedValue({
                successCount: 3,
                failureCount: 0,
                failures: [],
            });

            // Act
            const result = await syncScrapingPlaceList(
                'jra',
                '2024-04-01',
                '2024-04-30',
            );

            // Assert
            expect(result.successCount).toBe(3);
        });
    });

    describe('syncScrapingRaceList', () => {
        it('S-03_POST /sync/race に正しいJSONボディでリクエストする', async () => {
            // Arrange
            const placeIdList = ['jra2026012705'];
            const placeHeldDaysMap = {
                jra2026012705: { heldTimes: 1, heldDayTimes: 1 },
            };

            // Act
            await syncScrapingRaceList(placeIdList, placeHeldDaysMap);

            // Assert
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const urlArg = fetchSpy.mock.calls[0][0] as URL;
            expect(urlArg.pathname).toBe('/sync/race');
            const options = fetchSpy.mock.calls[0][2] as RequestInit;
            const body = JSON.parse(options.body as string) as {
                placeIdList: string[];
                placeHeldDaysMap: unknown;
            };
            expect(body.placeIdList).toEqual(placeIdList);
            expect(body.placeHeldDaysMap).toEqual(placeHeldDaysMap);
        });

        it('S-04_placeHeldDaysMap省略_空オブジェクトとして送信される', async () => {
            // Act
            await syncScrapingRaceList(['jra2026012705']);

            // Assert
            const options = fetchSpy.mock.calls[0][2] as RequestInit;
            const body = JSON.parse(options.body as string) as {
                placeHeldDaysMap: unknown;
            };
            expect(body.placeHeldDaysMap).toEqual({});
        });

        it('S-11_placeIdListがちょうどデフォルトチャンクサイズ(10)_1回のみPOSTされる', async () => {
            // Arrange
            const placeIdList = Array.from(
                { length: 10 },
                (_, index) => `place-${index}`,
            );

            // Act
            await syncScrapingRaceList(placeIdList);

            // Assert
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it('S-06_placeIdListがデフォルトチャンクサイズ(10)超_チャンク毎に複数回POSTされる', async () => {
            // Arrange
            const placeIdList = Array.from(
                { length: 11 },
                (_, index) => `place-${index}`,
            );

            // Act
            await syncScrapingRaceList(placeIdList);

            // Assert
            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const firstBody = JSON.parse(
                (fetchSpy.mock.calls[0][2] as RequestInit).body as string,
            ) as { placeIdList: string[] };
            const secondBody = JSON.parse(
                (fetchSpy.mock.calls[1][2] as RequestInit).body as string,
            ) as { placeIdList: string[] };
            expect(firstBody.placeIdList).toHaveLength(10);
            expect(secondBody.placeIdList).toHaveLength(1);
        });

        it('S-07_各チャンクのplaceHeldDaysMap_チャンクに含まれるIDのみへ絞り込まれる', async () => {
            // Arrange
            const placeIdList = Array.from(
                { length: 11 },
                (_, index) => `place-${index}`,
            );
            const placeHeldDaysMap = Object.fromEntries(
                placeIdList.map((placeId, index) => [
                    placeId,
                    { heldTimes: index, heldDayTimes: index },
                ]),
            );

            // Act
            await syncScrapingRaceList(placeIdList, placeHeldDaysMap);

            // Assert
            const firstBody = JSON.parse(
                (fetchSpy.mock.calls[0][2] as RequestInit).body as string,
            ) as { placeHeldDaysMap: Record<string, unknown> };
            const secondBody = JSON.parse(
                (fetchSpy.mock.calls[1][2] as RequestInit).body as string,
            ) as { placeHeldDaysMap: Record<string, unknown> };
            expect(Object.keys(firstBody.placeHeldDaysMap)).toHaveLength(10);
            expect(Object.keys(secondBody.placeHeldDaysMap)).toEqual([
                'place-10',
            ]);
        });

        it('S-08_チャンク分割時の各レスポンス_successCount等が集計される', async () => {
            // Arrange
            const placeIdList = Array.from(
                { length: 11 },
                (_, index) => `place-${index}`,
            );
            fetchSpy.mockReset();
            fetchSpy
                .mockResolvedValueOnce({
                    successCount: 10,
                    failureCount: 1,
                    failures: [{ db: 'race', id: 'place-3', reason: 'boom' }],
                })
                .mockResolvedValueOnce({
                    successCount: 1,
                    failureCount: 0,
                    failures: [],
                });

            // Act
            const result = await syncScrapingRaceList(placeIdList);

            // Assert
            expect(result.successCount).toBe(11);
            expect(result.failureCount).toBe(1);
            expect(result.failures).toEqual([
                { db: 'race', id: 'place-3', reason: 'boom' },
            ]);
        });

        it('S-09_SCRAPING_RACE_SYNC_CHUNK_SIZE=2_2件ずつのチャンクに分割される', async () => {
            // Arrange
            process.env.SCRAPING_RACE_SYNC_CHUNK_SIZE = '2';
            const placeIdList = ['place-0', 'place-1', 'place-2'];

            // Act
            await syncScrapingRaceList(placeIdList);

            // Assert
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it.each(['0', 'abc'])(
            'S-10_SCRAPING_RACE_SYNC_CHUNK_SIZE=%s_デフォルト(10)にフォールバックする',
            async (invalidValue) => {
                // Arrange
                process.env.SCRAPING_RACE_SYNC_CHUNK_SIZE = invalidValue;
                const placeIdList = Array.from(
                    { length: 11 },
                    (_, index) => `place-${index}`,
                );

                // Act
                await syncScrapingRaceList(placeIdList);

                // Assert
                expect(fetchSpy).toHaveBeenCalledTimes(2);
            },
        );
    });
});
