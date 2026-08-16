/**
 * raceDetailLayoutController.test.ts - RaceDetailLayoutController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | #  | メソッド | 条件                                  | 期待値                          |
 * |----|----------|----------------------------------------|-----------------------------------|
 * | 1  | page     | 常に                                    | 200・HTML                        |
 * | 2  | get      | usecase.getConfig()が正常               | 200 + {raceType, config}         |
 * | 3  | get      | usecase.getConfig()が例外               | 500                               |
 * | 4  | save     | 正常なbody                              | 200 + 保存後の構成                |
 * | 5  | save     | bodyが不正（configスキーマ違反）        | 400                               |
 * | 6  | save     | usecase.saveConfig()が例外              | 500                               |
 * | 7  | preview  | 正常なbody・レースが存在する             | 200 + 解決結果                    |
 * | 8  | preview  | bodyが不正（raceId欠落）                | 400                               |
 * | 9  | preview  | usecase.previewConfig()がundefinedを返す | 404                               |
 * | 10 | preview  | usecase.previewConfig()が例外            | 500                               |
 * | 11 | races    | usecase.listPreviewCandidates()が正常    | 200 + {races}                     |
 * | 12 | races    | usecase.listPreviewCandidates()が例外    | 500                               |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';
import { type RaceDetailUiConfig, RaceType } from '@race-schedule/core';

import { RaceDetailLayoutController } from '../../../src/controller/raceDetailLayoutController';
import type { RaceSummary } from '../../../src/dto/raceSummary';
import type { IRaceDetailLayoutUsecase } from '../../../src/usecase/interface/IRaceDetailLayoutUsecase';

interface MockRaceDetailLayoutUsecase {
    getConfig: Mock<IRaceDetailLayoutUsecase['getConfig']>;
    saveConfig: Mock<IRaceDetailLayoutUsecase['saveConfig']>;
    previewConfig: Mock<IRaceDetailLayoutUsecase['previewConfig']>;
    listPreviewCandidates: Mock<
        IRaceDetailLayoutUsecase['listPreviewCandidates']
    >;
}

const SAMPLE_CONFIG: RaceDetailUiConfig = {
    sections: [{ type: 'kv', fields: [{ key: 'time' }] }],
};

const SAMPLE_RACES: RaceSummary[] = [
    {
        raceId: 'keirin202608091',
        raceName: '開設70周年記念',
        raceCourse: '大宮',
        raceNumber: 7,
        raceGrade: 'GⅢ',
        datetime: '2026-08-09T10:00:00+09:00',
    },
];

const createMockUsecase = (
    overrides: Partial<MockRaceDetailLayoutUsecase> = {},
): MockRaceDetailLayoutUsecase => ({
    getConfig: mock(() => Promise.resolve(SAMPLE_CONFIG)),
    saveConfig: mock(() => Promise.resolve(SAMPLE_CONFIG)),
    previewConfig: mock(() =>
        Promise.resolve({ schemaVersion: 1 as const, sections: [] }),
    ),
    listPreviewCandidates: mock(() => Promise.resolve(SAMPLE_RACES)),
    ...overrides,
});

const buildRequest = (path: string, body: unknown): Request =>
    new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

describe('admin/controller/RaceDetailLayoutController', () => {
    describe('page', () => {
        it('1: 常に200とHTMLを返すこと', () => {
            const usecase = createMockUsecase();
            const controller = new RaceDetailLayoutController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
        });
    });

    describe('get', () => {
        it('2: usecase.getConfig()が正常な場合は200と{raceType, config}を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceDetailLayoutController(usecase);

            const res = await controller.get();

            expect(res.status).toBe(200);
            expect(usecase.getConfig).toHaveBeenCalledWith(RaceType.KEIRIN);
            const body = (await res.json()) as {
                raceType: string;
                config: RaceDetailUiConfig;
            };
            expect(body.raceType).toBe('keirin');
            expect(body.config).toEqual(SAMPLE_CONFIG);
        });

        it('3: usecase.getConfig()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                getConfig: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new RaceDetailLayoutController(usecase);

            const res = await controller.get();

            expect(res.status).toBe(500);
        });
    });

    describe('save', () => {
        it('4: 正常なbodyの場合は200と保存後の構成を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceDetailLayoutController(usecase);
            const req = buildRequest('/race-detail-layout/api', {
                config: SAMPLE_CONFIG,
            });

            const res = await controller.save(req);

            expect(res.status).toBe(200);
            expect(usecase.saveConfig).toHaveBeenCalledWith(
                RaceType.KEIRIN,
                SAMPLE_CONFIG,
            );
        });

        it('5: bodyが不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceDetailLayoutController(usecase);
            const req = buildRequest('/race-detail-layout/api', {
                config: { sections: [{ type: 'unknown' }] },
            });

            const res = await controller.save(req);

            expect(res.status).toBe(400);
        });

        it('6: usecase.saveConfig()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                saveConfig: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new RaceDetailLayoutController(usecase);
            const req = buildRequest('/race-detail-layout/api', {
                config: SAMPLE_CONFIG,
            });

            const res = await controller.save(req);

            expect(res.status).toBe(500);
        });
    });

    describe('preview', () => {
        it('7: 正常なbody・レースが存在する場合は200と解決結果を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceDetailLayoutController(usecase);
            const req = buildRequest('/race-detail-layout/api/preview', {
                config: SAMPLE_CONFIG,
                raceId: 'race-1',
            });

            const res = await controller.preview(req);

            expect(res.status).toBe(200);
            expect(usecase.previewConfig).toHaveBeenCalledWith(
                SAMPLE_CONFIG,
                'race-1',
            );
        });

        it('8: bodyが不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceDetailLayoutController(usecase);
            const req = buildRequest('/race-detail-layout/api/preview', {
                config: SAMPLE_CONFIG,
            });

            const res = await controller.preview(req);

            expect(res.status).toBe(400);
        });

        it('9: usecase.previewConfig()がundefinedを返す場合は404を返すこと', async () => {
            const usecase = createMockUsecase({
                previewConfig: mock(() => Promise.resolve(undefined)),
            });
            const controller = new RaceDetailLayoutController(usecase);
            const req = buildRequest('/race-detail-layout/api/preview', {
                config: SAMPLE_CONFIG,
                raceId: 'race-1',
            });

            const res = await controller.preview(req);

            expect(res.status).toBe(404);
        });

        it('10: usecase.previewConfig()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                previewConfig: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new RaceDetailLayoutController(usecase);
            const req = buildRequest('/race-detail-layout/api/preview', {
                config: SAMPLE_CONFIG,
                raceId: 'race-1',
            });

            const res = await controller.preview(req);

            expect(res.status).toBe(500);
        });
    });

    describe('races', () => {
        it('11: usecase.listPreviewCandidates()が正常な場合は200と{races}を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new RaceDetailLayoutController(usecase);

            const res = await controller.races();

            expect(res.status).toBe(200);
            expect(usecase.listPreviewCandidates).toHaveBeenCalledWith(14);
            const body = (await res.json()) as { races: RaceSummary[] };
            expect(body.races).toEqual(SAMPLE_RACES);
        });

        it('12: usecase.listPreviewCandidates()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                listPreviewCandidates: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new RaceDetailLayoutController(usecase);

            const res = await controller.races();

            expect(res.status).toBe(500);
        });
    });
});
