/**
 * backfillController.test.ts - BackfillController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                          | 期待値                     |
 * |---|----------|--------------------------------|------------------------------|
 * | 1 | page     | test環境（既定）              | 200・HTML（テスト環境向けfavicon/バッジ） |
 * | 2 | place    | 正常なbody                    | 200 + バックフィル結果      |
 * | 3 | place    | bodyが不正（raceTypeList欠落）| 400                          |
 * | 4 | place    | usecase.backfillPlace()が例外 | 500                          |
 * | 5 | race     | 正常なbody                    | 200 + バックフィル結果      |
 * | 6 | race     | usecase.backfillRace()が例外  | 500                          |
 * | 7 | page     | production環境                | 200・HTML（production向けfavicon/バッジ） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, describe, expect, it, type Mock, mock } from 'bun:test';
import 'reflect-metadata';

import { BackfillController } from '../../../src/controller/backfillController';
import type { IBackfillUsecase } from '../../../src/usecase/interface/IBackfillUsecase';

interface MockBackfillUsecase {
    backfillPlace: Mock<IBackfillUsecase['backfillPlace']>;
    backfillRace: Mock<IBackfillUsecase['backfillRace']>;
}

const SAMPLE_PLACE_RESULT = {
    successCount: 1,
    failureCount: 0,
    failures: [],
    notCachedKeys: [],
};

const SAMPLE_RACE_RESULT = {
    successCount: 0,
    failureCount: 0,
    failures: [],
    notCachedPlaceIds: [],
};

const createMockUsecase = (
    overrides: Partial<MockBackfillUsecase> = {},
): MockBackfillUsecase => ({
    backfillPlace: mock(() => Promise.resolve(SAMPLE_PLACE_RESULT)),
    backfillRace: mock(() => Promise.resolve(SAMPLE_RACE_RESULT)),
    ...overrides,
});

const buildRequest = (body: unknown): Request =>
    new Request('http://localhost/backfill/api/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

const VALID_BODY = {
    startDate: '2026-01-01',
    finishDate: '2026-01-31',
    raceTypeList: ['keirin'],
};

describe('admin/controller/BackfillController', () => {
    describe('page', () => {
        it('1: test環境（既定）では200とテスト環境向けHTMLを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new BackfillController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('<!doctype html>');
            expect(html).toContain('テスト環境');
        });
    });

    describe('place', () => {
        it('2: 正常なbodyの場合は200とバックフィル結果を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new BackfillController(usecase);
            const req = buildRequest(VALID_BODY);

            const res = await controller.place(req);

            expect(res.status).toBe(200);
            expect(usecase.backfillPlace).toHaveBeenCalledWith(VALID_BODY);
            const body = await res.json();
            expect(body).toEqual(SAMPLE_PLACE_RESULT);
        });

        it('3: bodyが不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new BackfillController(usecase);
            const req = buildRequest({ startDate: '2026-01-01' });

            const res = await controller.place(req);

            expect(res.status).toBe(400);
        });

        it('4: usecase.backfillPlace()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                backfillPlace: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new BackfillController(usecase);
            const req = buildRequest(VALID_BODY);

            const res = await controller.place(req);

            expect(res.status).toBe(500);
        });
    });

    describe('race', () => {
        it('5: 正常なbodyの場合は200とバックフィル結果を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new BackfillController(usecase);
            const req = buildRequest(VALID_BODY);

            const res = await controller.race(req);

            expect(res.status).toBe(200);
            expect(usecase.backfillRace).toHaveBeenCalledWith(VALID_BODY);
            const body = await res.json();
            expect(body).toEqual(SAMPLE_RACE_RESULT);
        });

        it('6: usecase.backfillRace()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                backfillRace: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new BackfillController(usecase);
            const req = buildRequest(VALID_BODY);

            const res = await controller.race(req);

            expect(res.status).toBe(500);
        });
    });

    describe('production環境', () => {
        const originalAdminEnvironment = process.env.ADMIN_ENVIRONMENT;

        afterEach(() => {
            process.env.ADMIN_ENVIRONMENT = originalAdminEnvironment;
        });

        it('7: pageはproduction向けfaviconとバッジを含むHTMLを返すこと', async () => {
            process.env.ADMIN_ENVIRONMENT = 'production';
            const usecase = createMockUsecase();
            const controller = new BackfillController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('本番環境');
        });
    });
});
