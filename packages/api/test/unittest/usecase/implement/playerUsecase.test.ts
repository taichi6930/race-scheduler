/**
 * ディシジョンテーブル
 * | 種別   | メソッド                 | 条件                 | expected           | 説明                     |
 * |-------|------------------------|---------------------|-------------------|--------------------------|
 * | 正常系 | fetchPlayerEntityList  | フィルタ条件指定       | PlayerEntity[]    | Service経由でデータ取得    |
 * | 正常系 | fetchPlayerEntityList  | 空の結果             | []                | 該当データなし             |
 * | 正常系 | upsertPlayerEntityList | 有効なエンティティ配列 | UpsertResult      | Service経由で登録/更新     |
 * | 正常系 | upsertPlayerEntityList | 空配列               | UpsertResult      | repository.upsert に [] が渡る |
 * | 異常系 | fetchPlayerEntityList  | repository.fetch が reject  | reject     | エラー伝播契約             |
 * | 異常系 | upsertPlayerEntityList | repository.upsert が reject | reject     | エラー伝播契約             |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    RaceType,
    SearchPlayerFilterParamsInput,
    validatePlayerEntity,
} from '@race-schedule/core';
import { container } from 'tsyringe';

import { PlayerUsecase } from '../../../../src/usecase/implement/playerUsecase';
import type { IPlayerUsecase } from '../../../../src/usecase/interface/IPlayerUsecase';
import { assertCalledWith, clearMocks } from '../../../common/clearMocks';
import { TestRepositorySetup } from '../../../common/TestRepositorySetup';
import { setupTestRepositoryMock } from '../../../testSetupHelper';

describe('PlayerUsecase', () => {
    let usecase: IPlayerUsecase;
    let repositorySetup: TestRepositorySetup;

    beforeEach(() => {
        repositorySetup = setupTestRepositoryMock();
        usecase = container.resolve(PlayerUsecase);
    });

    afterEach(() => {
        clearMocks();
    });

    describe('fetchPlayerEntityList', () => {
        it('フィルタ条件を指定してプレイヤー一覧を取得できること', async () => {
            const mockPlayers = [
                validatePlayerEntity({
                    raceType: 'keirin',
                    playerNo: '001',
                    playerName: '選手A',
                    priority: 1,
                }),
                validatePlayerEntity({
                    raceType: 'keirin',
                    playerNo: '002',
                    playerName: '選手B',
                    priority: 2,
                }),
            ];
            repositorySetup.playerRepository.fetch.mockResolvedValue(
                mockPlayers,
            );

            const filter: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
            };
            const result = await usecase.fetch(filter);

            expect(result).toEqual(mockPlayers);
            assertCalledWith(repositorySetup.playerRepository.fetch, filter);
        });

        it('該当データがない場合は空配列を返すこと', async () => {
            repositorySetup.playerRepository.fetch.mockResolvedValue([]);

            const filter: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.BOATRACE],
            };
            const result = await usecase.fetch(filter);

            expect(result).toEqual([]);
        });

        // 異常系: repository.fetch が reject した場合、usecase.fetch も同じエラーで reject すること
        it('fetch_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('Database connection failed');
            repositorySetup.playerRepository.fetch.mockRejectedValue(dbError);

            const filter: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
            };

            await expect(usecase.fetch(filter)).rejects.toThrow(
                'Database connection failed',
            );
        });
    });

    describe('upsertPlayerEntityList', () => {
        it('エンティティ配列をupsertできること', async () => {
            const mockUpsertResult = {
                successCount: 1,
                failureCount: 0,
                failures: [],
            };
            repositorySetup.playerRepository.upsert.mockResolvedValue(
                mockUpsertResult,
            );

            const entities = [
                validatePlayerEntity({
                    raceType: 'keirin',
                    playerNo: '001',
                    playerName: '選手A',
                    priority: 1,
                }),
            ];
            const result = await usecase.upsert(entities);

            expect(result).toEqual(mockUpsertResult);
            assertCalledWith(repositorySetup.playerRepository.upsert, entities);
        });

        // 空配列ケース（player は最薄で欠落していたため追加）
        it('空配列をupsertできること', async () => {
            const mockUpsertResult = {
                successCount: 0,
                failureCount: 0,
                failures: [],
            };
            repositorySetup.playerRepository.upsert.mockResolvedValue(
                mockUpsertResult,
            );

            const result = await usecase.upsert([]);

            expect(result).toEqual(mockUpsertResult);
            assertCalledWith(repositorySetup.playerRepository.upsert, []);
        });

        // 異常系: repository.upsert が reject した場合、usecase.upsert も同じエラーで reject すること
        it('upsert_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('DB constraint violation');
            repositorySetup.playerRepository.upsert.mockRejectedValue(dbError);

            const entities = [
                validatePlayerEntity({
                    raceType: 'keirin',
                    playerNo: '001',
                    playerName: '選手A',
                    priority: 1,
                }),
            ];

            await expect(usecase.upsert(entities)).rejects.toThrow(
                'DB constraint violation',
            );
        });
    });
});
