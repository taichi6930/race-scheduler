/**
 * featureFlagsController.test.ts - FeatureFlagsController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                               | 期待値                     |
 * |---|----------|-------------------------------------|------------------------------|
 * | 1 | page     | test環境（既定）                     | 200・HTML（テスト環境向けfavicon/バッジ） |
 * | 2 | list     | usecase.list()が正常                 | 200 + {flags:[...]}         |
 * | 3 | list     | usecase.list()が例外                 | 500                          |
 * | 4 | update   | 正常なbody                           | 200 + 更新後の一覧          |
 * | 5 | update   | bodyが不正（enabled欠落）            | 400                          |
 * | 6 | update   | usecase.setFlag()が例外              | 500                          |
 * | 7 | page     | production環境                       | 200・HTML（production向けfavicon/バッジ） |
 * | 8 | update   | production環境                       | 403・usecase.setFlag()は呼ばれない |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, describe, expect, it, type Mock, mock } from 'bun:test';
import 'reflect-metadata';

import { FeatureFlagsController } from '../../../src/controller/featureFlagsController';
import type { FeatureFlagStatus } from '../../../src/dto/featureFlagStatus';
import type { IFeatureFlagsUsecase } from '../../../src/usecase/interface/IFeatureFlagsUsecase';

interface MockFeatureFlagsUsecase {
    list: Mock<IFeatureFlagsUsecase['list']>;
    setFlag: Mock<IFeatureFlagsUsecase['setFlag']>;
}

const SAMPLE_FLAGS: FeatureFlagStatus[] = [
    {
        key: 'announcement_banner',
        label: '起動時お知らせバナー',
        storedEnabled: true,
        envDefault: false,
        effectiveEnabled: true,
        updatedAt: '2026-08-07T00:00:00.000Z',
    },
];

const createMockUsecase = (
    overrides: Partial<MockFeatureFlagsUsecase> = {},
): MockFeatureFlagsUsecase => ({
    list: mock(() => Promise.resolve(SAMPLE_FLAGS)),
    setFlag: mock(() => Promise.resolve(SAMPLE_FLAGS)),
    ...overrides,
});

const buildUpdateRequest = (body: unknown): Request =>
    new Request('http://localhost/flags/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

describe('admin/controller/FeatureFlagsController', () => {
    describe('page', () => {
        it('1: test環境（既定）では200とテスト環境向けHTMLを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new FeatureFlagsController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('<!doctype html>');
            expect(html).toContain('テスト環境');
        });
    });

    describe('list', () => {
        it('2: usecase.list()が正常な場合は200とフラグ一覧を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new FeatureFlagsController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(200);
            const body = (await res.json()) as { flags: FeatureFlagStatus[] };
            expect(body.flags).toEqual(SAMPLE_FLAGS);
        });

        it('3: usecase.list()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                list: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new FeatureFlagsController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(500);
        });
    });

    describe('update', () => {
        it('4: 正常なbodyの場合は200と更新後の一覧を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new FeatureFlagsController(usecase);
            const req = buildUpdateRequest({
                key: 'announcement_banner',
                enabled: true,
            });

            const res = await controller.update(req);

            expect(res.status).toBe(200);
            expect(usecase.setFlag).toHaveBeenCalledWith(
                'announcement_banner',
                true,
            );
            const body = (await res.json()) as { flags: FeatureFlagStatus[] };
            expect(body.flags).toEqual(SAMPLE_FLAGS);
        });

        it('5: bodyが不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new FeatureFlagsController(usecase);
            const req = buildUpdateRequest({ key: 'announcement_banner' });

            const res = await controller.update(req);

            expect(res.status).toBe(400);
        });

        it('6: usecase.setFlag()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                setFlag: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new FeatureFlagsController(usecase);
            const req = buildUpdateRequest({
                key: 'announcement_banner',
                enabled: true,
            });

            const res = await controller.update(req);

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
            const controller = new FeatureFlagsController(usecase);

            const res = controller.page();

            expect(res.status).toBe(200);
            const html = await res.text();
            expect(html).toContain('本番環境');
        });

        it('8: updateは403を返しusecase.setFlag()を呼ばないこと', async () => {
            process.env.ADMIN_ENVIRONMENT = 'production';
            const usecase = createMockUsecase();
            const controller = new FeatureFlagsController(usecase);
            const req = buildUpdateRequest({
                key: 'announcement_banner',
                enabled: true,
            });

            const res = await controller.update(req);

            expect(res.status).toBe(403);
            expect(usecase.setFlag).not.toHaveBeenCalled();
        });
    });
});
