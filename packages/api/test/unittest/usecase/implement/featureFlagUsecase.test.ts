/**
 * featureFlagUsecase.test.ts - FeatureFlagUsecase ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: resolve()
 * | ケース | repository.get()の結果 | 環境変数(FEATURE_ANNOUNCEMENT_BANNER_ENABLED) | 期待値 |
 * |--------|--------------------------|-------------------------------------------------|--------|
 * | R1 | true（D1に行あり） | 'false' | true（D1優先） |
 * | R2 | undefined（D1に行なし） | 'true' | true（環境変数へフォールバック） |
 * | R3 | undefined（D1に行なし） | 未設定 | false |
 *
 * ### メソッド: list()
 * | ケース | repository.list()の結果 | 期待値 |
 * |--------|----------------------------|--------|
 * | L1 | announcement_bannerの行あり | storedEnabled/effectiveEnabledともにDB値 |
 * | L2 | 行なし | storedEnabled:undefined、effectiveEnabledは環境変数の既定値 |
 *
 * ### メソッド: setFlag()
 * | ケース | key | 期待値 |
 * |--------|-----|--------|
 * | S1 | 定義済みキー（announcement_banner） | repository.upsert()が呼ばれる |
 * | S2 | 未定義キー | ValidationErrorをthrowし、repository.upsert()は呼ばれない |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { EnvStore, ValidationError } from '@race-schedule/core';
import 'reflect-metadata';

import type { IFeatureFlagRepository } from '../../../../src/repository/interface/IFeatureFlagRepository';
import { FeatureFlagUsecase } from '../../../../src/usecase/implement/featureFlagUsecase';

const ANNOUNCEMENT_BANNER_KEY = 'announcement_banner';

describe('api/usecase/FeatureFlagUsecase', () => {
    afterEach(() => {
        EnvStore.reset();
    });

    describe('resolve', () => {
        // R1: D1に行あり(true) → D1優先でtrue
        it('R1: D1に行がある場合はD1の値を優先すること', async () => {
            EnvStore.setEnv({
                FEATURE_ANNOUNCEMENT_BANNER_ENABLED: 'false',
            } as never);
            const repository: IFeatureFlagRepository = {
                list: mock(() => Promise.resolve([])),
                get: mock(() => Promise.resolve(true)),
                upsert: mock(() => Promise.resolve()),
            };
            const usecase = new FeatureFlagUsecase(repository);

            const result = await usecase.resolve(ANNOUNCEMENT_BANNER_KEY);

            expect(result).toBe(true);
        });

        // R2: D1に行なし・環境変数true → true
        it('R2: D1に行が無い場合は環境変数の値へフォールバックすること', async () => {
            EnvStore.setEnv({
                FEATURE_ANNOUNCEMENT_BANNER_ENABLED: 'true',
            } as never);
            const repository: IFeatureFlagRepository = {
                list: mock(() => Promise.resolve([])),
                get: mock(() => Promise.resolve(undefined)),
                upsert: mock(() => Promise.resolve()),
            };
            const usecase = new FeatureFlagUsecase(repository);

            const result = await usecase.resolve(ANNOUNCEMENT_BANNER_KEY);

            expect(result).toBe(true);
        });

        // R3: D1に行なし・環境変数未設定 → false
        it('R3: D1に行が無く環境変数も未設定の場合はfalseを返すこと', async () => {
            EnvStore.setEnv({} as never);
            const repository: IFeatureFlagRepository = {
                list: mock(() => Promise.resolve([])),
                get: mock(() => Promise.resolve(undefined)),
                upsert: mock(() => Promise.resolve()),
            };
            const usecase = new FeatureFlagUsecase(repository);

            const result = await usecase.resolve(ANNOUNCEMENT_BANNER_KEY);

            expect(result).toBe(false);
        });
    });

    describe('list', () => {
        // L1: 行あり → storedEnabled/effectiveEnabledともにDB値
        it('L1: D1に行がある場合はstoredEnabled/effectiveEnabledともにDB値を返すこと', async () => {
            EnvStore.setEnv({
                FEATURE_ANNOUNCEMENT_BANNER_ENABLED: 'false',
            } as never);
            const repository: IFeatureFlagRepository = {
                list: mock(() =>
                    Promise.resolve([
                        {
                            flagKey: ANNOUNCEMENT_BANNER_KEY,
                            enabled: true,
                            updatedAt: '2026-08-07T00:00:00.000Z',
                        },
                    ]),
                ),
                get: mock(() => Promise.resolve(undefined)),
                upsert: mock(() => Promise.resolve()),
            };
            const usecase = new FeatureFlagUsecase(repository);

            const result = await usecase.list();

            expect(result).toEqual([
                {
                    key: ANNOUNCEMENT_BANNER_KEY,
                    label: '起動時お知らせバナー（SDUI PoC）',
                    storedEnabled: true,
                    envDefault: false,
                    effectiveEnabled: true,
                    updatedAt: '2026-08-07T00:00:00.000Z',
                },
            ]);
        });

        // L2: 行なし → storedEnabled:undefined、effectiveEnabledは環境変数の既定値
        it('L2: D1に行が無い場合はstoredEnabled:undefinedかつ環境変数の既定値がeffectiveEnabledになること', async () => {
            EnvStore.setEnv({
                FEATURE_ANNOUNCEMENT_BANNER_ENABLED: 'true',
            } as never);
            const repository: IFeatureFlagRepository = {
                list: mock(() => Promise.resolve([])),
                get: mock(() => Promise.resolve(undefined)),
                upsert: mock(() => Promise.resolve()),
            };
            const usecase = new FeatureFlagUsecase(repository);

            const result = await usecase.list();

            expect(result).toEqual([
                {
                    key: ANNOUNCEMENT_BANNER_KEY,
                    label: '起動時お知らせバナー（SDUI PoC）',
                    storedEnabled: undefined,
                    envDefault: true,
                    effectiveEnabled: true,
                    updatedAt: undefined,
                },
            ]);
        });
    });

    describe('setFlag', () => {
        // S1: 定義済みキー → repository.upsert()が呼ばれる
        it('S1: 定義済みキーの場合はrepository.upsert()を呼ぶこと', async () => {
            const repository: IFeatureFlagRepository = {
                list: mock(() => Promise.resolve([])),
                get: mock(() => Promise.resolve(undefined)),
                upsert: mock(() => Promise.resolve()),
            };
            const usecase = new FeatureFlagUsecase(repository);

            await usecase.setFlag(ANNOUNCEMENT_BANNER_KEY, true);

            expect(repository.upsert).toHaveBeenCalledWith(
                ANNOUNCEMENT_BANNER_KEY,
                true,
            );
        });

        // S2: 未定義キー → ValidationErrorをthrow、upsertは呼ばれない
        it('S2: 未定義キーの場合はValidationErrorをthrowしrepository.upsert()を呼ばないこと', async () => {
            const repository: IFeatureFlagRepository = {
                list: mock(() => Promise.resolve([])),
                get: mock(() => Promise.resolve(undefined)),
                upsert: mock(() => Promise.resolve()),
            };
            const usecase = new FeatureFlagUsecase(repository);

            await expect(usecase.setFlag('unknown_flag', true)).rejects.toThrow(
                ValidationError,
            );
            expect(repository.upsert).not.toHaveBeenCalled();
        });
    });
});
