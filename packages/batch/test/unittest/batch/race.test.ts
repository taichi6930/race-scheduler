/**
 * batch/race.ts (runRaceBatch) UT
 *
 * DTO→Entity変換・ID生成・メインAPIへのUpsertはscraping Workerの
 * POST /sync/race に委譲されたため、runRaceBatchが担うのは
 * buildPlaceInfoMap（メインAPI優先・サービス間の調整ロジック。NARのみ
 * `place`データを介さず月間CSVから直接placeIdを列挙する）と
 * syncScrapingRaceListの呼び出し・戻り値の受け渡しのみである。
 *
 * | #    | テストケース                                          | Expected                                          |
 * |------|---------------------------------------------------------|----------------------------------------------------|
 * | R-01 | OVERSEAS: placeId を月単位で生成                        | fetchMainPlaceList が呼ばれない                    |
 * | R-02 | メインAPI 成功 → placeIdList/placeHeldDaysMap を渡す     | syncScrapingRaceListに正しい引数                   |
 * | R-03 | メインAPI 空返却 + 非JRA（KEIRIN） → 空 map で 0 返却    | syncScrapingRaceList 未呼び出し                    |
 * | R-04 | メインAPI throw + 非JRA（KEIRIN） → 空 map で 0 返却     | syncScrapingRaceList 未呼び出し                    |
 * | R-05 | syncScrapingRaceListのsuccessCountがそのまま返り値になる | 戻り値が successCount と一致                       |
 * | R-06 | JRA + メインAPI 空返却 → JRA 分岐で空 map                | 0 返却・syncScrapingRaceList 未呼び出し            |
 * | R-07 | NAR は`place`データを介さずCSVからplaceIdを直接取得する | fetchMainPlaceList未呼び出し・取得結果をそのままsync |
 * | R-08 | KEIRIN で isRaceListAvailable=false → 取得対象から除外   | placeIdList に false の placeId を含まない          |
 * | R-09 | syncScrapingRaceList が reject                           | runRaceBatch も reject で伝播する                  |
 * | R-10 | failureCount が1件以上（OBS-027）                        | 握りつぶさず例外を投げる                            |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
    formatJstDatetime,
    generatePlaceId,
    RaceType,
    validateLocationCode,
} from '@race-schedule/core';

import { runRaceBatch } from '../../../src/batch/race';
import * as scrapingClient from '../../../src/client/scraping';

interface MockResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
}

const okJson = (data: unknown): MockResponse => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
    json: async () => data,
});

interface FetchCall {
    url: string;
    method?: string;
    body?: string;
}

const installFetchSpy = (
    handler: (call: FetchCall) => MockResponse | Promise<MockResponse>,
): { spy: ReturnType<typeof spyOn>; calls: FetchCall[] } => {
    const calls: FetchCall[] = [];
    const spy = spyOn(globalThis, 'fetch');
    spy.mockImplementation((async (
        input: string | URL | Request,
        init?: RequestInit,
    ) => {
        const url =
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        const call: FetchCall = {
            url,
            method: init?.method,
            body: init?.body as string | undefined,
        };
        calls.push(call);
        return handler(call);
    }) as unknown as typeof fetch);
    return { spy, calls };
};

describe('runRaceBatch', () => {
    let fetchSpy: ReturnType<typeof spyOn> | undefined;
    let syncSpy: ReturnType<typeof spyOn>;
    let listNarPlaceIdsSpy: ReturnType<typeof spyOn> | undefined;

    beforeEach(() => {
        process.env.SCRAPING_API_URL = 'http://scraping.test';
        process.env.MAIN_API_URL = 'http://main.test';
        syncSpy = spyOn(scrapingClient, 'syncScrapingRaceList');
        syncSpy.mockResolvedValue({
            successCount: 0,
            failureCount: 0,
            failures: [],
        });
    });

    afterEach(() => {
        fetchSpy?.mockRestore();
        fetchSpy = undefined;
        syncSpy.mockRestore();
        listNarPlaceIdsSpy?.mockRestore();
        listNarPlaceIdsSpy = undefined;
    });

    it('R-01_OVERSEAS_fetchMainPlaceListは呼ばれず月単位placeIdでsync呼び出しされる', async () => {
        const { spy, calls } = installFetchSpy(() => okJson({ places: [] }));
        fetchSpy = spy;

        await runRaceBatch({
            raceType: RaceType.OVERSEAS,
            startDate: '2026-01-01',
            finishDate: '2026-03-31',
        });

        // main API への place 取得は呼ばれない
        const mainPlaceCalls = calls.filter(
            (c) => c.url.includes('main.test') && c.url.includes('/place'),
        );
        expect(mainPlaceCalls.length).toBe(0);
        expect(syncSpy).toHaveBeenCalledTimes(1);
        const placeIdList = syncSpy.mock.calls[0][0] as string[];
        // 2026-01-01〜2026-03-31 は厳密に3ヶ月（1月・2月・3月）分
        expect(placeIdList.length).toBe(3);
    });

    it('R-02_メインAPI成功_placeIdListとplaceHeldDaysMapを渡してsyncする', async () => {
        const placeId = generatePlaceId(
            RaceType.JRA,
            formatJstDatetime(new Date('2026-01-10T00:00:00+09:00')),
            validateLocationCode('05'),
        );
        const { spy } = installFetchSpy((c) => {
            if (c.url.includes('main.test') && c.url.includes('/place')) {
                return okJson({
                    places: [
                        {
                            placeId,
                            raceType: RaceType.JRA,
                            datetime: '2026-01-10T00:00:00+09:00',
                            raceCourse: '東京',
                            locationCode: validateLocationCode('05'),
                            placeHeldDays: {
                                heldTimes: 1,
                                heldDayTimes: 1,
                            },
                        },
                    ],
                });
            }
            return okJson({});
        });
        fetchSpy = spy;

        await runRaceBatch({
            raceType: RaceType.JRA,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(syncSpy).toHaveBeenCalledTimes(1);
        const [placeIdList, placeHeldDaysMap] = syncSpy.mock.calls[0] as [
            string[],
            Record<string, { heldTimes: number; heldDayTimes: number }>,
        ];
        expect(placeIdList).toEqual([placeId]);
        expect(placeHeldDaysMap[placeId]).toEqual({
            heldTimes: 1,
            heldDayTimes: 1,
        });
    });

    it('R-03_メインAPI空返却_非JRA(KEIRIN)でも空mapで0返却しsync未呼び出し', async () => {
        const { spy } = installFetchSpy((c) => {
            if (c.url.includes('main.test') && c.url.includes('/place')) {
                return okJson({ places: [] });
            }
            return okJson({});
        });
        fetchSpy = spy;

        const result = await runRaceBatch({
            raceType: RaceType.KEIRIN,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(result).toBe(0);
        expect(syncSpy).not.toHaveBeenCalled();
    });

    it('R-04_メインAPIエラー_非JRA(KEIRIN)でも空mapで0返却しsync未呼び出し', async () => {
        const { spy } = installFetchSpy((c) => {
            if (c.url.includes('main.test') && c.url.includes('/place')) {
                return {
                    ok: false,
                    status: 500,
                    text: async () => 'Internal Server Error',
                    json: async () => ({}),
                };
            }
            return okJson({});
        });
        fetchSpy = spy;

        const result = await runRaceBatch({
            raceType: RaceType.KEIRIN,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(result).toBe(0);
        expect(syncSpy).not.toHaveBeenCalled();
    });

    it('R-05_syncScrapingRaceListのsuccessCountがそのまま返り値になる', async () => {
        const placeId = generatePlaceId(
            RaceType.AUTORACE,
            formatJstDatetime(new Date('2026-01-10T00:00:00+09:00')),
            validateLocationCode('05'),
        );
        const { spy } = installFetchSpy((c) => {
            if (c.url.includes('main.test') && c.url.includes('/place')) {
                return okJson({
                    places: [
                        {
                            placeId,
                            raceType: RaceType.AUTORACE,
                            datetime: '2026-01-10T00:00:00+09:00',
                            raceCourse: '飯塚',
                            locationCode: validateLocationCode('05'),
                            placeGrade: 'SG',
                        },
                    ],
                });
            }
            return okJson({});
        });
        fetchSpy = spy;
        syncSpy.mockResolvedValue({
            successCount: 4,
            failureCount: 0,
            failures: [],
        });

        const result = await runRaceBatch({
            raceType: RaceType.AUTORACE,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(result).toBe(4);
    });

    it('R-06_JRAでメインAPI空返却_JRA分岐で空mapとなり0を返す', async () => {
        const { spy } = installFetchSpy((c) => {
            if (c.url.includes('main.test') && c.url.includes('/place')) {
                return okJson({ places: [] });
            }
            return okJson({});
        });
        fetchSpy = spy;

        const result = await runRaceBatch({
            raceType: RaceType.JRA,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(result).toBe(0);
        expect(syncSpy).not.toHaveBeenCalled();
    });

    it('R-07_NARは`place`データを介さず期間指定でscrapingへ直接依頼する', async () => {
        // NARはメインAPIの /place も syncScrapingRaceList（placeIdList指定モード）も
        // 一切呼ばない。main.test宛のfetchが発生したら異常とみなすため、
        // 呼ばれたら失敗するレスポンスを返す。
        const { spy, calls } = installFetchSpy((c) => {
            if (c.url.includes('main.test')) {
                return {
                    ok: false,
                    status: 500,
                    text: async () => 'main API should not be called for NAR',
                    json: async () => ({}),
                };
            }
            return okJson({});
        });
        fetchSpy = spy;

        listNarPlaceIdsSpy = spyOn(
            scrapingClient,
            'syncScrapingNarRaceByDateRange',
        );
        listNarPlaceIdsSpy.mockResolvedValue({
            successCount: 5,
            failureCount: 0,
            failures: [],
        });

        const result = await runRaceBatch({
            raceType: RaceType.NAR,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(listNarPlaceIdsSpy).toHaveBeenCalledWith(
            '2026-01-01',
            '2026-01-31',
        );
        const mainPlaceCalls = calls.filter((c) => c.url.includes('main.test'));
        expect(mainPlaceCalls.length).toBe(0);
        expect(syncSpy).not.toHaveBeenCalled();
        expect(result).toBe(5);
    });

    it('R-08_KEIRINでisRaceListAvailable=falseの開催場は取得対象から除外される', async () => {
        const availablePlaceId = generatePlaceId(
            RaceType.KEIRIN,
            formatJstDatetime(new Date('2026-01-10T00:00:00+09:00')),
            validateLocationCode('11'),
        );
        const unavailablePlaceId = generatePlaceId(
            RaceType.KEIRIN,
            formatJstDatetime(new Date('2026-01-11T00:00:00+09:00')),
            validateLocationCode('12'),
        );
        const { spy } = installFetchSpy((c) => {
            if (c.url.includes('main.test') && c.url.includes('/place')) {
                return okJson({
                    places: [
                        {
                            placeId: availablePlaceId,
                            raceType: RaceType.KEIRIN,
                            datetime: '2026-01-10T00:00:00+09:00',
                            raceCourse: '函館',
                            locationCode: validateLocationCode('11'),
                            placeGrade: 'GP',
                            isRaceListAvailable: true,
                        },
                        {
                            placeId: unavailablePlaceId,
                            raceType: RaceType.KEIRIN,
                            datetime: '2026-01-11T00:00:00+09:00',
                            raceCourse: '青森',
                            locationCode: validateLocationCode('12'),
                            placeGrade: 'GP',
                            isRaceListAvailable: false,
                        },
                    ],
                });
            }
            return okJson({});
        });
        fetchSpy = spy;

        await runRaceBatch({
            raceType: RaceType.KEIRIN,
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
        });

        expect(syncSpy).toHaveBeenCalledTimes(1);
        const placeIdList = syncSpy.mock.calls[0][0] as string[];
        expect(placeIdList).toContain(availablePlaceId);
        expect(placeIdList).not.toContain(unavailablePlaceId);
    });

    it('R-09_syncScrapingRaceListがreject_runRaceBatchもrejectで伝播すること', async () => {
        const { spy } = installFetchSpy(() => okJson({ places: [] }));
        fetchSpy = spy;
        syncSpy.mockRejectedValue(new Error('Internal Server Error'));

        await expect(
            runRaceBatch({
                raceType: RaceType.OVERSEAS,
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
            }),
        ).rejects.toThrow('Internal Server Error');
    });

    it('R-10_failureCountが1件以上_握りつぶさず例外を投げること', async () => {
        const { spy } = installFetchSpy(() => okJson({ places: [] }));
        fetchSpy = spy;
        syncSpy.mockResolvedValue({
            successCount: 2,
            failureCount: 1,
            failures: [{ db: 'main', id: 'race-x', reason: 'boom' }],
        });

        await expect(
            runRaceBatch({
                raceType: RaceType.OVERSEAS,
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
            }),
        ).rejects.toThrow('Race sync failed for 1 item(s): race-x: boom');
    });
});
