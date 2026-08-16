/**
 * | No | パラメータ例/ボディ例         | Usecase戻り値 | 期待される動作 |
 * |----|------------------------------|---------------|---------------|
 * | 1  | get:全パラメータ有効          | race1件       | 200+count=1   |
 * | 2  | get:startDate欠落             | -             | 400           |
 * | 3  | get:finishDate欠落            | -             | 400           |
 * | 4  | get:raceTypeList欠落/無効     | -             | 400           |
 * | 5  | get:usecase例外               | -             | 500           |
 * | 6  | upsert:正常配列               | successCount  | 200           |
 * | 7  | upsert:空配列/非配列          | -             | 400           |
 * | 8  | upsert:要素不正               | -             | 400           |
 * | 9  | upsert:usecase例外            | -             | 500           |
 * | 10 | calendarEvent:正常系           | イベント1件    | 200           |
 * | 11 | calendarEvent:raceId欠落       | -             | 400           |
 * | 12 | calendarEvent:raceId形式不正   | -             | 400           |
 * | 13 | calendarEvent:該当レースなし    | null          | 404           |
 * | 14 | calendarEvent:usecase例外      | -             | 500           |
 * | 15 | get:KEIRIN・GⅢ・S級一般（負け戦）| -             | isCalendarSpecified=false |
 * | 16 | get:KEIRIN・GⅠ・S級決勝（決勝）  | -             | isCalendarSpecified=true  |
 * | 17 | get:watchedRaceIdsに含まれるレースあり | -       | 該当レースのみisWatched=true（KPLAYER-07） |
 * | 18 | players:正常系                | 選手2件        | 200+players=2  |
 * | 19 | players:raceId欠落             | -             | 400            |
 * | 20 | players:raceId形式不正         | -             | 400            |
 * | 21 | players:usecase例外            | -             | 500            |
 * | 22 | raceDetailUi:正常系             | UIスキーマ1件  | 200            |
 * | 23 | raceDetailUi:raceId欠落         | -             | 400            |
 * | 24 | raceDetailUi:raceId形式不正     | -             | 400            |
 * | 25 | raceDetailUi:該当レースなし      | null          | 404            |
 * | 26 | raceDetailUi:usecase例外        | -             | 500            |
 */
import type {
    RaceDetailUi,
    RaceEntity,
    UpsertResult,
} from '@race-schedule/core';
import {
    createEmptyUpsertResult,
    RaceType,
    validateLocationCode,
} from '@race-schedule/core';
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';
import { RaceFactory } from '../../../../../tests/shared/factories';
import { RaceController } from '../../../src/controller/raceController';
import type {
    CalendarEventPreview,
    IRaceUsecase,
} from '../../../src/usecase/interface/IRaceUsecase';

interface MockRaceUsecase {
    fetch: Mock<IRaceUsecase['fetch']>;
    upsert: Mock<IRaceUsecase['upsert']>;
    fetchCalendarEvent: Mock<IRaceUsecase['fetchCalendarEvent']>;
    fetchWatchedRaceIds: Mock<IRaceUsecase['fetchWatchedRaceIds']>;
    fetchRacePlayers: Mock<IRaceUsecase['fetchRacePlayers']>;
    fetchRaceDetailUi: Mock<IRaceUsecase['fetchRaceDetailUi']>;
}

const createMockUsecase = (
    overrides: Partial<MockRaceUsecase> = {},
): MockRaceUsecase => ({
    fetch: mock(() => Promise.resolve([])),
    upsert: mock(() => Promise.resolve(createEmptyUpsertResult())),
    fetchCalendarEvent: mock(() => Promise.resolve(null)),
    fetchWatchedRaceIds: mock(() => Promise.resolve(new Set<string>())),
    fetchRacePlayers: mock(() => Promise.resolve([])),
    fetchRaceDetailUi: mock(() => Promise.resolve(null)),
    ...overrides,
});

interface CountResponseBody {
    count: number;
}

interface RaceListResponseBody {
    races: { isCalendarSpecified: boolean; isWatched: boolean }[];
}

describe('api/controller/RaceController', () => {
    it('get returns races and validates query', async () => {
        const mockData: RaceEntity[] = [
            RaceFactory.create({
                raceType: RaceType.JRA,
                datetime: new Date('2026-01-01T09:00:00+09:00'),
                locationCode: validateLocationCode('05'),
                raceNumber: 1,
                overrides: {
                    raceName: 'レース',
                    raceGrade: 'GⅠ',
                },
            }),
        ];
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.resolve(mockData)),
        });
        const controller = new RaceController(usecase);
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

    it('get returns isCalendarSpecified computed from raceGrade', async () => {
        const mockData: RaceEntity[] = [
            RaceFactory.create({
                raceType: RaceType.JRA,
                datetime: new Date('2026-01-01T09:00:00+09:00'),
                locationCode: validateLocationCode('05'),
                raceNumber: 1,
                overrides: { raceName: '重賞レース', raceGrade: 'GⅠ' },
            }),
            RaceFactory.create({
                raceType: RaceType.JRA,
                datetime: new Date('2026-01-01T09:00:00+09:00'),
                locationCode: validateLocationCode('05'),
                raceNumber: 2,
                overrides: { raceName: '平場レース', raceGrade: '未勝利' },
            }),
        ];
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.resolve(mockData)),
        });
        const controller = new RaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        const body = (await res.json()) as RaceListResponseBody;
        expect(body.races[0].isCalendarSpecified).toBe(true);
        expect(body.races[1].isCalendarSpecified).toBe(false);
    });

    it('get: KEIRINのGⅠ・S級一次予選（負け戦・priority<6）はisCalendarSpecified=falseになる', async () => {
        const mockData: RaceEntity[] = [
            RaceFactory.create({
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-01-01T09:00:00+09:00'),
                locationCode: validateLocationCode('43'),
                raceNumber: 1,
                overrides: { raceGrade: 'GⅠ', raceStage: 'S級一次予選' },
            }),
        ];
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.resolve(mockData)),
        });
        const controller = new RaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'keirin',
        });
        const res = await controller.get(params);
        const body = (await res.json()) as RaceListResponseBody;
        expect(body.races[0].isCalendarSpecified).toBe(false);
    });

    it('get: KEIRINのGⅠ・S級決勝（決勝・priority>=6）はisCalendarSpecified=trueになる', async () => {
        const mockData: RaceEntity[] = [
            RaceFactory.create({
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-01-01T09:00:00+09:00'),
                locationCode: validateLocationCode('43'),
                raceNumber: 1,
                overrides: { raceGrade: 'GⅠ', raceStage: 'S級決勝' },
            }),
        ];
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.resolve(mockData)),
        });
        const controller = new RaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'keirin',
        });
        const res = await controller.get(params);
        const body = (await res.json()) as RaceListResponseBody;
        expect(body.races[0].isCalendarSpecified).toBe(true);
    });

    it('get: watchedRaceIdsに含まれるレースのみisWatched=trueになる（KPLAYER-07）', async () => {
        const mockData: RaceEntity[] = [
            RaceFactory.create({
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-08-02T09:00:00+09:00'),
                locationCode: validateLocationCode('36'),
                raceNumber: 1,
            }),
            RaceFactory.create({
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-08-02T09:00:00+09:00'),
                locationCode: validateLocationCode('36'),
                raceNumber: 2,
            }),
        ];
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.resolve(mockData)),
            fetchWatchedRaceIds: mock(() =>
                Promise.resolve(new Set([mockData[0].raceId])),
            ),
        });
        const controller = new RaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-08-02',
            finishDate: '2026-08-03',
            raceTypeList: 'keirin',
        });
        const res = await controller.get(params);
        const body = (await res.json()) as RaceListResponseBody;
        expect(body.races[0].isWatched).toBe(true);
        expect(body.races[1].isWatched).toBe(false);
        expect(usecase.fetchWatchedRaceIds).toHaveBeenCalledWith([
            mockData[0].raceId,
            mockData[1].raceId,
        ]);
    });

    it('upsert rejects invalid payload', async () => {
        const usecase = createMockUsecase();
        const controller = new RaceController(usecase);
        const invalidBody = [{ raceId: 'x', placeId: 'y' }];
        const req = new Request('http://localhost/race', {
            method: 'POST',
            body: JSON.stringify(invalidBody),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
    });

    it('get returns 400 when startDate missing', async () => {
        const usecase = createMockUsecase();
        const controller = new RaceController(usecase);
        const params = new URLSearchParams({
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(400);
    });

    it('get returns 400 when finishDate missing', async () => {
        const usecase = createMockUsecase();
        const controller = new RaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(400);
    });

    it('get returns 500 when usecase.fetch throws', async () => {
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.reject(new Error('boom'))),
        });
        const controller = new RaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(500);
    });

    it('upsert returns 400 for non-array body', async () => {
        const usecase = createMockUsecase();
        const controller = new RaceController(usecase);
        const req = new Request('http://localhost/race', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
    });

    it('upsert returns 400 for empty array', async () => {
        const usecase = createMockUsecase();
        const controller = new RaceController(usecase);
        const req = new Request('http://localhost/race', {
            method: 'POST',
            body: JSON.stringify([]),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
    });

    it('upsert returns 500 when usecase.upsert throws', async () => {
        const usecase = createMockUsecase({
            upsert: mock(() => Promise.reject(new Error('upsert fail'))),
        });
        const controller = new RaceController(usecase);
        const valid = [
            {
                raceId: 'jra202601010101',
                placeId: 'jra2026010101',
                raceType: 'jra',
                datetime: '2026-01-01T00:00:00Z',
                locationCode: validateLocationCode('01'),
                raceCourse: '東京',
                raceName: 'レース名',
                raceGrade: 'GⅢ',
                raceNumber: 1,
                conditionData: { surfaceType: '芝', distance: 1600 },
                placeHeldDays: { heldTimes: 1, heldDayTimes: 1 },
            },
        ];
        const req = new Request('http://localhost/race', {
            method: 'POST',
            body: JSON.stringify(valid),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(500);
    });

    it('upsert success returns 200 and successCount', async () => {
        const usecase = createMockUsecase({
            upsert: mock(() =>
                Promise.resolve({
                    successCount: 2,
                    failureCount: 0,
                    failures: [],
                }),
            ),
        });
        const controller = new RaceController(usecase);
        const valid = [
            {
                raceId: 'jra202601010102',
                placeId: 'jra2026010102',
                raceType: 'jra',
                datetime: '2026-01-01T00:00:00Z',
                locationCode: validateLocationCode('01'),
                raceCourse: '東京',
                raceName: 'レース名',
                raceGrade: 'GⅢ',
                raceNumber: 1,
                conditionData: { surfaceType: '芝', distance: 1600 },
                placeHeldDays: { heldTimes: 1, heldDayTimes: 1 },
            },
        ];
        const req = new Request('http://localhost/race', {
            method: 'POST',
            body: JSON.stringify(valid),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(200);
        const body = (await res.json()) as UpsertResult;
        expect(body.successCount).toBe(2);
    });

    describe('calendarEvent', () => {
        it('該当レースが存在する場合、カレンダーイベントプレビューを200で返すこと', async () => {
            const mockEvent: CalendarEventPreview = {
                summary: 'テストレース',
                description: '発走: 10:20\n更新日時: 2026/07/23 12:00',
                location: '新潟競馬場',
                start: {
                    dateTime: '2026-07-25T10:20:00+09:00',
                    timeZone: 'Asia/Tokyo',
                },
                end: {
                    dateTime: '2026-07-25T10:30:00+09:00',
                    timeZone: 'Asia/Tokyo',
                },
                links: [
                    {
                        label: 'レース情報(netkeiba)',
                        url: 'https://netkeiba.page.link/?link=example',
                    },
                ],
            };
            const usecase = createMockUsecase({
                fetchCalendarEvent: mock(() => Promise.resolve(mockEvent)),
            });
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'jra202607250402',
            });

            const res = await controller.calendarEvent(params);

            expect(res.status).toBe(200);
            const body = (await res.json()) as CalendarEventPreview;
            expect(body).toEqual(mockEvent);
        });

        it('raceIdが指定されていない場合、400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceController(usecase);

            const res = await controller.calendarEvent(new URLSearchParams());

            expect(res.status).toBe(400);
        });

        it('raceIdの形式が不正な場合、400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'not-a-valid-race-id',
            });

            const res = await controller.calendarEvent(params);

            expect(res.status).toBe(400);
        });

        it('該当レースが存在しない場合、404を返すこと', async () => {
            const usecase = createMockUsecase({
                fetchCalendarEvent: mock(() => Promise.resolve(null)),
            });
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'jra202607250403',
            });

            const res = await controller.calendarEvent(params);

            expect(res.status).toBe(404);
        });

        it('usecaseが例外をthrowした場合、500を返すこと', async () => {
            const usecase = createMockUsecase({
                fetchCalendarEvent: mock(() =>
                    Promise.reject(new Error('boom')),
                ),
            });
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'jra202607250402',
            });

            const res = await controller.calendarEvent(params);

            expect(res.status).toBe(500);
        });
    });

    describe('players', () => {
        it('該当レースの出走選手一覧を200で返すこと', async () => {
            const players = [
                {
                    carNumber: 1,
                    frameNumber: 1,
                    playerNo: '014833',
                    playerName: '高久保雄介',
                    term: 100,
                    branch: '京都',
                },
                {
                    carNumber: 2,
                    frameNumber: 2,
                    playerNo: '014834',
                    playerName: '梁島邦友',
                },
            ];
            const usecase = createMockUsecase({
                fetchRacePlayers: mock(() => Promise.resolve(players)),
            });
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'keirin202608023601',
            });

            const res = await controller.players(params);

            expect(res.status).toBe(200);
            const body = (await res.json()) as { players: unknown[] };
            expect(body.players).toEqual(players);
        });

        it('raceIdが指定されていない場合、400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceController(usecase);

            const res = await controller.players(new URLSearchParams());

            expect(res.status).toBe(400);
        });

        it('raceIdの形式が不正な場合、400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'not-a-valid-race-id',
            });

            const res = await controller.players(params);

            expect(res.status).toBe(400);
        });

        it('usecaseが例外をthrowした場合、500を返すこと', async () => {
            const usecase = createMockUsecase({
                fetchRacePlayers: mock(() => Promise.reject(new Error('boom'))),
            });
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'keirin202608023601',
            });

            const res = await controller.players(params);

            expect(res.status).toBe(500);
        });
    });

    describe('raceDetailUi', () => {
        it('No22: 正常系の場合、200とUIスキーマを返すこと', async () => {
            const detail: RaceDetailUi = {
                schemaVersion: 1,
                sections: [
                    {
                        type: 'kv',
                        rows: [{ label: '発走', value: '14:33' }],
                    },
                ],
            };
            const usecase = createMockUsecase({
                fetchRaceDetailUi: mock(() => Promise.resolve(detail)),
            });
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'keirin202608023601',
            });

            const res = await controller.raceDetailUi(params);

            expect(res.status).toBe(200);
            const body = (await res.json()) as RaceDetailUi;
            expect(body).toEqual(detail);
        });

        it('No23: raceIdが指定されていない場合、400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceController(usecase);

            const res = await controller.raceDetailUi(new URLSearchParams());

            expect(res.status).toBe(400);
        });

        it('No24: raceIdの形式が不正な場合、400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'not-a-valid-race-id',
            });

            const res = await controller.raceDetailUi(params);

            expect(res.status).toBe(400);
        });

        it('No25: 該当レースが存在しない場合、404を返すこと', async () => {
            const usecase = createMockUsecase({
                fetchRaceDetailUi: mock(() => Promise.resolve(null)),
            });
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'keirin202608023601',
            });

            const res = await controller.raceDetailUi(params);

            expect(res.status).toBe(404);
        });

        it('No26: usecaseが例外をthrowした場合、500を返すこと', async () => {
            const usecase = createMockUsecase({
                fetchRaceDetailUi: mock(() =>
                    Promise.reject(new Error('boom')),
                ),
            });
            const controller = new RaceController(usecase);
            const params = new URLSearchParams({
                raceId: 'keirin202608023601',
            });

            const res = await controller.raceDetailUi(params);

            expect(res.status).toBe(500);
        });
    });
});
