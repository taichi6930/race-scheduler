/**
 * internalFeatureFlagsController.test.ts - InternalFeatureFlagsController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件                                  | 期待値                     |
 * |---|----------|----------------------------------------|------------------------------|
 * | 1 | list     | usecase.list()が正常                    | 200 + {flags:[...]}         |
 * | 2 | list     | usecase.list()が例外                    | 500                          |
 * | 3 | update   | 正常なbody                              | 200 + 更新後の一覧          |
 * | 4 | update   | bodyが不正（enabled欠落）               | 400                          |
 * | 5 | update   | setFlag()がValidationErrorをthrow       | 400                          |
 * | 6 | update   | usecase.list()（更新後の再取得）が例外  | 500                          |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it, type Mock, mock } from 'bun:test';
import { ValidationError } from '@race-schedule/core';
import 'reflect-metadata';

import { InternalFeatureFlagsController } from '../../../src/controller/internalFeatureFlagsController';
import type {
    FeatureFlagStatus,
    IFeatureFlagUsecase,
} from '../../../src/usecase/interface/IFeatureFlagUsecase';

interface MockFeatureFlagUsecase {
    resolve: Mock<IFeatureFlagUsecase['resolve']>;
    list: Mock<IFeatureFlagUsecase['list']>;
    setFlag: Mock<IFeatureFlagUsecase['setFlag']>;
}

const SAMPLE_FLAGS: FeatureFlagStatus[] = [
    {
        key: 'announcement_banner',
        label: '起動時お知らせバナー（SDUI PoC）',
        storedEnabled: true,
        envDefault: false,
        effectiveEnabled: true,
        updatedAt: '2026-08-07T00:00:00.000Z',
    },
];

const createMockUsecase = (
    overrides: Partial<MockFeatureFlagUsecase> = {},
): MockFeatureFlagUsecase => ({
    resolve: mock(() => Promise.resolve(true)),
    list: mock(() => Promise.resolve(SAMPLE_FLAGS)),
    setFlag: mock(() => Promise.resolve()),
    ...overrides,
});

describe('api/controller/InternalFeatureFlagsController', () => {
    describe('list', () => {
        it('1: usecase.list()が正常な場合は200とフラグ一覧を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalFeatureFlagsController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(200);
            const body = (await res.json()) as { flags: FeatureFlagStatus[] };
            expect(body.flags).toEqual(SAMPLE_FLAGS);
        });

        it('2: usecase.list()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                list: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new InternalFeatureFlagsController(usecase);

            const res = await controller.list();

            expect(res.status).toBe(500);
        });
    });

    describe('update', () => {
        const buildUpdateRequest = (body: unknown): Request =>
            new Request('http://localhost/internal/feature-flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

        it('3: 正常なbodyの場合は200と更新後の一覧を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalFeatureFlagsController(usecase);
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

        it('4: bodyが不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new InternalFeatureFlagsController(usecase);
            const req = buildUpdateRequest({ key: 'announcement_banner' });

            const res = await controller.update(req);

            expect(res.status).toBe(400);
        });

        it('5: setFlag()がValidationErrorをthrowした場合は400を返すこと', async () => {
            const usecase = createMockUsecase({
                setFlag: mock(() => {
                    throw new ValidationError('未知の機能フラグキーです');
                }),
            });
            const controller = new InternalFeatureFlagsController(usecase);
            const req = buildUpdateRequest({
                key: 'unknown_flag',
                enabled: true,
            });

            const res = await controller.update(req);

            expect(res.status).toBe(400);
        });

        it('6: 更新後のusecase.list()が例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                list: mock(() => {
                    throw new Error('boom');
                }),
            });
            const controller = new InternalFeatureFlagsController(usecase);
            const req = buildUpdateRequest({
                key: 'announcement_banner',
                enabled: true,
            });

            const res = await controller.update(req);

            expect(res.status).toBe(500);
        });
    });
});
