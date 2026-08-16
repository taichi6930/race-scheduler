/**
 * BackfillController テスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件 | 期待される動作 |
 * |----|---------|------|----------------|
 * | 1  | place | 正常なボディ | 200 + usecase.backfillPlaceの戻り値 |
 * | 2  | place | raceTypeList欠落 | 400 |
 * | 3  | place | startDate > finishDate | 400 |
 * | 4  | place | usecase例外 | 500 |
 * | 5  | race  | 正常なボディ | 200 + usecase.backfillRaceの戻り値 |
 * | 6  | race  | raceTypeList欠落 | 400 |
 * | 7  | race  | usecase例外 | 500 |
 */

import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';

import { BackfillController } from '../../../src/controller/backfillController';
import type { IBackfillUsecase } from '../../../src/usecase/interface/IBackfillUsecase';

interface MockBackfillUsecase {
    backfillPlace: Mock<IBackfillUsecase['backfillPlace']>;
    backfillRace: Mock<IBackfillUsecase['backfillRace']>;
}

const createMockUsecase = (
    overrides: Partial<MockBackfillUsecase> = {},
): MockBackfillUsecase => ({
    backfillPlace: mock(() =>
        Promise.resolve({
            successCount: 0,
            failureCount: 0,
            failures: [],
            notCachedKeys: [],
        }),
    ),
    backfillRace: mock(() =>
        Promise.resolve({
            successCount: 0,
            failureCount: 0,
            failures: [],
            notCachedPlaceIds: [],
        }),
    ),
    ...overrides,
});

const VALID_BODY = {
    startDate: '2026-01-01',
    finishDate: '2026-01-31',
    raceTypeList: ['keirin'],
};

interface BackfillResponseBody {
    successCount: number;
}

describe('api/controller/BackfillController', () => {
    it('#1: place は正常なボディでusecase.backfillPlaceの戻り値を200で返す', async () => {
        const usecase = createMockUsecase({
            backfillPlace: mock(() =>
                Promise.resolve({
                    successCount: 3,
                    failureCount: 0,
                    failures: [],
                    notCachedKeys: [],
                }),
            ),
        });
        const controller = new BackfillController(usecase);
        const req = new Request('http://localhost/internal/backfill/place', {
            method: 'POST',
            body: JSON.stringify(VALID_BODY),
        });

        const res = await controller.place(req);

        expect(res.status).toBe(200);
        const body = (await res.json()) as BackfillResponseBody;
        expect(body.successCount).toBe(3);
        expect(usecase.backfillPlace).toHaveBeenCalledTimes(1);
    });

    it('#2: place はraceTypeList欠落で400を返す', async () => {
        const usecase = createMockUsecase();
        const controller = new BackfillController(usecase);
        const req = new Request('http://localhost/internal/backfill/place', {
            method: 'POST',
            body: JSON.stringify({
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
            }),
        });

        const res = await controller.place(req);

        expect(res.status).toBe(400);
    });

    it('#3: place はstartDateがfinishDateを超える場合400を返す', async () => {
        const usecase = createMockUsecase();
        const controller = new BackfillController(usecase);
        const req = new Request('http://localhost/internal/backfill/place', {
            method: 'POST',
            body: JSON.stringify({
                startDate: '2026-02-01',
                finishDate: '2026-01-01',
                raceTypeList: ['keirin'],
            }),
        });

        const res = await controller.place(req);

        expect(res.status).toBe(400);
    });

    it('#4: place はusecase例外で500を返す', async () => {
        const usecase = createMockUsecase({
            backfillPlace: mock(() => Promise.reject(new Error('boom'))),
        });
        const controller = new BackfillController(usecase);
        const req = new Request('http://localhost/internal/backfill/place', {
            method: 'POST',
            body: JSON.stringify(VALID_BODY),
        });

        const res = await controller.place(req);

        expect(res.status).toBe(500);
    });

    it('#5: race は正常なボディでusecase.backfillRaceの戻り値を200で返す', async () => {
        const usecase = createMockUsecase({
            backfillRace: mock(() =>
                Promise.resolve({
                    successCount: 5,
                    failureCount: 0,
                    failures: [],
                    notCachedPlaceIds: ['keirin2026010101'],
                }),
            ),
        });
        const controller = new BackfillController(usecase);
        const req = new Request('http://localhost/internal/backfill/race', {
            method: 'POST',
            body: JSON.stringify(VALID_BODY),
        });

        const res = await controller.race(req);

        expect(res.status).toBe(200);
        const body = (await res.json()) as BackfillResponseBody;
        expect(body.successCount).toBe(5);
        expect(usecase.backfillRace).toHaveBeenCalledTimes(1);
    });

    it('#6: race はraceTypeList欠落で400を返す', async () => {
        const usecase = createMockUsecase();
        const controller = new BackfillController(usecase);
        const req = new Request('http://localhost/internal/backfill/race', {
            method: 'POST',
            body: JSON.stringify({
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
            }),
        });

        const res = await controller.race(req);

        expect(res.status).toBe(400);
    });

    it('#7: race はusecase例外で500を返す', async () => {
        const usecase = createMockUsecase({
            backfillRace: mock(() => Promise.reject(new Error('boom'))),
        });
        const controller = new BackfillController(usecase);
        const req = new Request('http://localhost/internal/backfill/race', {
            method: 'POST',
            body: JSON.stringify(VALID_BODY),
        });

        const res = await controller.race(req);

        expect(res.status).toBe(500);
    });
});
