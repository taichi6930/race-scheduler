/**
 * | No | パラメータ例/ボディ例         | Usecase戻り値 | 期待される動作 |
 * |----|------------------------------|---------------|---------------|
 * | 1  | get:全パラメータ有効          | place1件      | 200+count=1   |
 * | 2  | get:startDate欠落             | -             | 400           |
 * | 3  | get:finishDate欠落            | -             | 400           |
 * | 4  | get:raceTypeList欠落/無効     | -             | 400           |
 * | 5  | get:usecase例外               | -             | 500           |
 * | 6  | upsert:正常配列               | successCount  | 200           |
 * | 7  | upsert:空配列/非配列          | -             | 400           |
 * | 8  | upsert:要素不正               | -             | 400           |
 * | 9  | upsert:usecase例外            | -             | 500           |
 */
import type { PlaceEntity, UpsertResult } from '@race-schedule/core';
import {
    createEmptyUpsertResult,
    validateLocationCode,
    validatePlaceId,
} from '@race-schedule/core';
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';

import { PlaceController } from '../../../src/controller/placeController';
import type { IPlaceUsecase } from '../../../src/usecase/interface/IPlaceUsecase';

interface MockPlaceUsecase {
    fetch: Mock<IPlaceUsecase['fetch']>;
    upsert: Mock<IPlaceUsecase['upsert']>;
}

const createMockUsecase = (
    overrides: Partial<MockPlaceUsecase> = {},
): MockPlaceUsecase => ({
    fetch: mock(() => Promise.resolve([])),
    upsert: mock(() => Promise.resolve(createEmptyUpsertResult())),
    ...overrides,
});

interface CountResponseBody {
    count: number;
}

interface UpsertErrorResponseBody {
    status: number;
    message: string;
    errors: { index: number; reason: string }[];
}

describe('api/controller/PlaceController', () => {
    it('get returns places and uses usecase.fetch', async () => {
        const mockData: PlaceEntity[] = [
            {
                placeId: validatePlaceId('jra2026010101'),
                raceType: 'jra',
                datetime: new Date('2026-01-01T09:00:00+09:00'),
                raceCourse: '東京',
                locationCode: validateLocationCode('05'),
                placeGrade: 'A',
                placeHeldDays: { heldTimes: 1, heldDayTimes: 1 },
            },
        ];
        const usecase = createMockUsecase({
            fetch: mock(() => Promise.resolve(mockData)),
        });
        const controller = new PlaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(200);
        const body = (await res.json()) as CountResponseBody;
        expect(body.count).toBe(1);
        // usecase.fetch へ渡されるfilterの中身（startDate/finishDate/raceTypeList）を検証
        expect(usecase.fetch).toHaveBeenCalledTimes(1);
        // `YYYY-MM-DD` はJST深夜0時としてパースされる（`new Date('YYYY-MM-DD')`が
        // UTC深夜0時になる仕様とは異なる。queryParamParser.ts参照）
        expect(usecase.fetch).toHaveBeenCalledWith({
            startDate: new Date('2026-01-01T00:00:00+09:00'),
            finishDate: new Date('2026-01-02T00:00:00+09:00'),
            raceTypeList: ['jra'],
        });
    });

    it('upsert validates body and rejects invalid payload', async () => {
        const usecase = createMockUsecase();
        const controller = new PlaceController(usecase);
        const invalidBody = [
            { placeId: 'x', raceType: 'jra' }, // missing required fields
        ];
        const req = new Request('http://localhost/place', {
            method: 'POST',
            body: JSON.stringify(invalidBody),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
    });

    it('get returns 400 when raceTypeList missing', async () => {
        const usecase = createMockUsecase();
        const controller = new PlaceController(usecase);
        const searchParams = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
        });
        const response = await controller.get(searchParams);
        expect(response.status).toBe(400);
    });

    it('upsert returns 400 and includes index/reason for invalid element', async () => {
        const usecase = createMockUsecase();
        const controller = new PlaceController(usecase);
        const invalid = [{ placeId: 'x', raceType: 'jra' }];
        const req = new Request('http://localhost/place', {
            method: 'POST',
            body: JSON.stringify(invalid),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
        const body = (await res.json()) as UpsertErrorResponseBody;
        expect(body).toHaveProperty('status', 400);
        expect(body).toHaveProperty('message');
        expect(body).toHaveProperty('errors');
        expect(Array.isArray(body.errors)).toBe(true);
        expect(body.errors[0]).toHaveProperty('index');
        expect(body.errors[0]).toHaveProperty('reason');
    });

    it('upsert returns 500 when usecase.upsert throws', async () => {
        const usecase = createMockUsecase({
            upsert: mock(() => Promise.reject(new Error('db'))),
        });
        const controller = new PlaceController(usecase);
        const valid = [
            {
                placeId: 'nar2026010101',
                raceType: 'nar',
                datetime: '2026-01-01T00:00:00Z',
                raceCourse: '北見ば',
                locationCode: validateLocationCode('05'),
            },
        ];
        const req = new Request('http://localhost/place', {
            method: 'POST',
            body: JSON.stringify(valid),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(500);
    });

    it('get returns 400 when startDate missing', async () => {
        const usecase = createMockUsecase();
        const controller = new PlaceController(usecase);
        const params = new URLSearchParams({
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(400);
    });

    it('get returns 400 when finishDate missing', async () => {
        const usecase = createMockUsecase();
        const controller = new PlaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(400);
    });

    it('get returns 400 when raceTypeList has no valid values', async () => {
        const usecase = createMockUsecase();
        const controller = new PlaceController(usecase);
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
            fetch: mock(() => Promise.reject(new Error('fail'))),
        });
        const controller = new PlaceController(usecase);
        const params = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-02',
            raceTypeList: 'jra',
        });
        const res = await controller.get(params);
        expect(res.status).toBe(500);
    });

    it('upsert returns 400 when body is empty array', async () => {
        const usecase = createMockUsecase();
        const controller = new PlaceController(usecase);
        const req = new Request('http://localhost/place', {
            method: 'POST',
            body: JSON.stringify([]),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
    });

    it('upsert returns 400 when body is not an array', async () => {
        const usecase = createMockUsecase();
        const controller = new PlaceController(usecase);
        const req = new Request('http://localhost/place', {
            method: 'POST',
            body: JSON.stringify({}),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(400);
    });

    it('upsert success returns 200 and passes Date objects to usecase', async () => {
        const usecase = createMockUsecase({
            upsert: mock((entities: PlaceEntity[]) => {
                expect(Array.isArray(entities)).toBe(true);
                expect(entities.length).toBe(1);
                expect(entities[0].datetime instanceof Date).toBe(true);
                return Promise.resolve({
                    successCount: 1,
                    failureCount: 0,
                    failures: [],
                });
            }),
        });
        const controller = new PlaceController(usecase);
        const valid = [
            {
                placeId: 'jra2026010101',
                raceType: 'jra',
                datetime: '2026-01-01T00:00:00Z',
                raceCourse: '東京',
                placeHeldDays: { heldTimes: 1, heldDayTimes: 1 },
                locationCode: validateLocationCode('05'),
            },
        ];
        const req = new Request('http://localhost/place', {
            method: 'POST',
            body: JSON.stringify(valid),
        });
        const res = await controller.upsert(req);
        expect(res.status).toBe(200);
        const body = (await res.json()) as UpsertResult;
        expect(body.successCount).toBe(1);
    });
});
