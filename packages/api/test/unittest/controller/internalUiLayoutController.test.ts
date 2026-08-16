/**
 * internalUiLayoutController.test.ts - InternalUiLayoutController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                                       | 期待値                     |
 * |---|----------|----------------------------------------------|------------------------------|
 * | 1 | get      | raceType指定・正常                            | 200 + {raceType, config}    |
 * | 2 | get      | raceType未指定                                | 400                          |
 * | 3 | get      | raceTypeが不正な値                            | 400                          |
 * | 4 | get      | usecase.getConfig()が例外                     | 500                          |
 * | 5 | save     | 正常なbody                                    | 200 + 保存内容               |
 * | 6 | save     | bodyが不正（configがスキーマ不一致）          | 400                          |
 * | 7 | save     | usecase.saveConfig()が例外                    | 500                          |
 * | 8 | preview  | 正常なbody・該当レースあり                     | 200 + 解決済みUIスキーマ     |
 * | 9 | preview  | bodyが不正                                    | 400                          |
 * | 10| preview  | raceIdの形式が不正                            | 400                          |
 * | 11| preview  | 該当レースなし                                | 404                          |
 * | 12| preview  | usecase.previewConfig()が例外                 | 500                          |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it, type Mock, mock } from 'bun:test';
import type { RaceDetailUi, RaceDetailUiConfig } from '@race-schedule/core';
import 'reflect-metadata';

import { InternalUiLayoutController } from '../../../src/controller/internalUiLayoutController';
import type { IUiLayoutUsecase } from '../../../src/usecase/interface/IUiLayoutUsecase';

interface MockUiLayoutUsecase {
    getConfig: Mock<IUiLayoutUsecase['getConfig']>;
    saveConfig: Mock<IUiLayoutUsecase['saveConfig']>;
    previewConfig: Mock<IUiLayoutUsecase['previewConfig']>;
}

const SAMPLE_CONFIG: RaceDetailUiConfig = {
    sections: [{ type: 'kv', fields: [{ key: 'grade' }] }],
};

const SAMPLE_PREVIEW: RaceDetailUi = {
    schemaVersion: 1,
    sections: [{ type: 'kv', rows: [{ label: 'グレード', value: 'GⅢ' }] }],
};

const createMockUsecase = (
    overrides: Partial<MockUiLayoutUsecase> = {},
): MockUiLayoutUsecase => ({
    getConfig: mock(() => Promise.resolve(SAMPLE_CONFIG)),
    saveConfig: mock(() => Promise.resolve()),
    previewConfig: mock(() => Promise.resolve(SAMPLE_PREVIEW)),
    ...overrides,
});

describe('api/controller/InternalUiLayoutController', () => {
    describe('get', () => {
        it('1: raceType指定・正常な場合は200と{raceType, config}を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalUiLayoutController(usecase);
            const params = new URLSearchParams({ raceType: 'keirin' });

            const res = await controller.get(params);

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                raceType: string;
                config: RaceDetailUiConfig;
            };
            expect(body.raceType).toBe('keirin');
            expect(body.config).toEqual(SAMPLE_CONFIG);
        });

        it('2: raceTypeが指定されていない場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalUiLayoutController(usecase);

            const res = await controller.get(new URLSearchParams());

            expect(res.status).toBe(400);
        });

        it('3: raceTypeが不正な値の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalUiLayoutController(usecase);
            const params = new URLSearchParams({ raceType: 'not-a-race-type' });

            const res = await controller.get(params);

            expect(res.status).toBe(400);
        });

        it('4: usecase.getConfig()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                getConfig: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new InternalUiLayoutController(usecase);
            const params = new URLSearchParams({ raceType: 'keirin' });

            const res = await controller.get(params);

            expect(res.status).toBe(500);
        });
    });

    describe('save', () => {
        const buildSaveRequest = (body: unknown): Request =>
            new Request('http://localhost/internal/ui-layout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

        it('5: 正常なbodyの場合は200と保存内容を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalUiLayoutController(usecase);
            const req = buildSaveRequest({
                raceType: 'keirin',
                config: SAMPLE_CONFIG,
            });

            const res = await controller.save(req);

            expect(res.status).toBe(200);
            expect(usecase.saveConfig).toHaveBeenCalledWith(
                'keirin',
                SAMPLE_CONFIG,
            );
        });

        it('6: configがスキーマ不一致の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalUiLayoutController(usecase);
            const req = buildSaveRequest({
                raceType: 'keirin',
                config: { sections: [{ type: 'odds' }] },
            });

            const res = await controller.save(req);

            expect(res.status).toBe(400);
        });

        it('7: usecase.saveConfig()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                saveConfig: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new InternalUiLayoutController(usecase);
            const req = buildSaveRequest({
                raceType: 'keirin',
                config: SAMPLE_CONFIG,
            });

            const res = await controller.save(req);

            expect(res.status).toBe(500);
        });
    });

    describe('preview', () => {
        const buildPreviewRequest = (body: unknown): Request =>
            new Request('http://localhost/internal/ui-layout/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

        it('8: 正常なbody・該当レースありの場合は200と解決済みUIスキーマを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalUiLayoutController(usecase);
            const req = buildPreviewRequest({
                config: SAMPLE_CONFIG,
                raceId: 'keirin202608023601',
            });

            const res = await controller.preview(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as RaceDetailUi;
            expect(body).toEqual(SAMPLE_PREVIEW);
        });

        it('9: bodyが不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalUiLayoutController(usecase);
            const req = buildPreviewRequest({ config: SAMPLE_CONFIG });

            const res = await controller.preview(req);

            expect(res.status).toBe(400);
        });

        it('10: raceIdの形式が不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalUiLayoutController(usecase);
            const req = buildPreviewRequest({
                config: SAMPLE_CONFIG,
                raceId: 'not-a-valid-race-id',
            });

            const res = await controller.preview(req);

            expect(res.status).toBe(400);
        });

        it('11: 該当レースが無い場合は404を返すこと', async () => {
            const usecase = createMockUsecase({
                previewConfig: mock(() => Promise.resolve(null)),
            });
            const controller = new InternalUiLayoutController(usecase);
            const req = buildPreviewRequest({
                config: SAMPLE_CONFIG,
                raceId: 'keirin202608023601',
            });

            const res = await controller.preview(req);

            expect(res.status).toBe(404);
        });

        it('12: usecase.previewConfig()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                previewConfig: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new InternalUiLayoutController(usecase);
            const req = buildPreviewRequest({
                config: SAMPLE_CONFIG,
                raceId: 'keirin202608023601',
            });

            const res = await controller.preview(req);

            expect(res.status).toBe(500);
        });
    });
});
