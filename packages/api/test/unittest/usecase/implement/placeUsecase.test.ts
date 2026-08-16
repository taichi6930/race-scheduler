/**
 * ディシジョンテーブル
 * fetch・upsert ともに repository への純粋な委譲であるため、
 * 「正しい引数で repository メソッドが呼ばれ、戻り値がそのまま返ること」を検証する。
 * さらに repository が reject した場合に usecase もそのまま reject する
 * （エラー伝播契約）ことを検証する。
 *
 * | #  | メソッド | 条件                   | expected                                      |
 * |----|---------|------------------------|-----------------------------------------------|
 * | 1  | fetch   | フィルタ条件あり・結果あり | repository.fetch に同じ filter、PlaceEntity[] が返る |
 * | 2  | fetch   | 結果が0件               | repository.fetch に同じ filter、[] が返る            |
 * | 3  | upsert  | エンティティ配列あり      | repository.upsert に同じ entities、UpsertResult が返る |
 * | 4  | upsert  | 空配列                  | repository.upsert に [] が渡り、UpsertResult が返る    |
 * | 5  | fetch   | repository.fetch が reject | usecase.fetch も同じエラーで reject する          |
 * | 6  | upsert  | repository.upsert が reject | usecase.upsert も同じエラーで reject する         |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { SearchPlaceFilterParamsInput } from '@race-schedule/core';
import {
    RaceType,
    validateLocationCode,
    validatePlaceId,
} from '@race-schedule/core';
import { container } from 'tsyringe';

import { PlaceUsecase } from '../../../../src/usecase/implement/placeUsecase';
import type { IPlaceUsecase } from '../../../../src/usecase/interface/IPlaceUsecase';
import {
    assertCalledWith,
    clearMocks,
    type TestRepositorySetup,
} from '../../../common';
import { setupTestRepositoryMock } from '../../../testSetupHelper';

describe('PlaceUsecase', () => {
    let usecase: IPlaceUsecase;
    let repositorySetup: TestRepositorySetup;
    beforeEach(() => {
        repositorySetup = setupTestRepositoryMock();
        usecase = container.resolve(PlaceUsecase);
    });

    afterEach(() => {
        clearMocks();
    });

    describe('fetch', () => {
        it('フィルタ条件を指定して開催場一覧を取得できること', async () => {
            const mockPlaces = [
                {
                    placeId: validatePlaceId('jra2025010501'),
                    raceType: RaceType.JRA,
                    datetime: new Date('2025-01-05'),
                    locationCode: validateLocationCode('01'),
                    raceCourse: '東京',
                    placeGrade: undefined,
                    placeHeldDays: { heldTimes: 1, heldDayTimes: 1 },
                },
            ];
            repositorySetup.placeRepository.fetch.mockResolvedValue(mockPlaces);

            const filter: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };
            const result = await usecase.fetch(filter);

            expect(result).toEqual(mockPlaces);
            assertCalledWith(repositorySetup.placeRepository.fetch, filter);
        });

        it('該当データがない場合は空配列を返すこと', async () => {
            repositorySetup.placeRepository.fetch.mockResolvedValue([]);

            const filter: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.NAR],
            };
            const result = await usecase.fetch(filter);

            expect(result).toEqual([]);
            assertCalledWith(repositorySetup.placeRepository.fetch, filter);
        });

        // 5: repository.fetch が reject した場合、usecase.fetch も同じエラーで reject すること
        it('fetch_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('Database connection failed');
            repositorySetup.placeRepository.fetch.mockRejectedValue(dbError);

            const filter: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };

            await expect(usecase.fetch(filter)).rejects.toThrow(
                'Database connection failed',
            );
        });
    });

    describe('upsert', () => {
        it('エンティティ配列をupsertできること', async () => {
            const mockUpsertResult = {
                successCount: 1,
                failureCount: 0,
                failures: [],
            };
            repositorySetup.placeRepository.upsert.mockResolvedValue(
                mockUpsertResult,
            );

            const entities = [
                {
                    placeId: validatePlaceId('jra2025010501'),
                    raceType: RaceType.JRA,
                    datetime: new Date('2025-01-05'),
                    locationCode: validateLocationCode('01'),
                    raceCourse: '東京',
                    placeGrade: undefined,
                    placeHeldDays: undefined,
                },
            ];
            const result = await usecase.upsert(entities);

            expect(result).toEqual(mockUpsertResult);
            assertCalledWith(repositorySetup.placeRepository.upsert, entities);
        });

        it('空配列をupsertできること', async () => {
            const mockUpsertResult = {
                successCount: 0,
                failureCount: 0,
                failures: [],
            };
            repositorySetup.placeRepository.upsert.mockResolvedValue(
                mockUpsertResult,
            );

            const result = await usecase.upsert([]);

            expect(result).toEqual(mockUpsertResult);
            assertCalledWith(repositorySetup.placeRepository.upsert, []);
        });

        // 6: repository.upsert が reject した場合、usecase.upsert も同じエラーで reject すること
        it('upsert_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('DB constraint violation');
            repositorySetup.placeRepository.upsert.mockRejectedValue(dbError);

            const entities = [
                {
                    placeId: validatePlaceId('jra2025010501'),
                    raceType: RaceType.JRA,
                    datetime: new Date('2025-01-05'),
                    locationCode: validateLocationCode('01'),
                    raceCourse: '東京',
                    placeGrade: undefined,
                    placeHeldDays: undefined,
                },
            ];

            await expect(usecase.upsert(entities)).rejects.toThrow(
                'DB constraint violation',
            );
        });
    });
});
