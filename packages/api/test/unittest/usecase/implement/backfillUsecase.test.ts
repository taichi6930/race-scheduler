/**
 * BackfillUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド | 条件 | 期待される動作 | Coverage |
 * |----|---------|------|----------------|----------|
 * | 1  | backfillPlace | 正常系 | cacheOnly:true付きでBackfillRepository.syncPlaceを呼ぶ | Line |
 * | 2  | backfillRace | PlaceRepository.fetchが0件 | BackfillRepository.syncRaceを呼ばず空結果を返す | Branch |
 * | 3  | backfillRace | PlaceRepository.fetchが1件以上（placeHeldDaysあり） | placeIdList・placeHeldDaysMapを組み立ててsyncRaceを呼ぶ | Branch |
 * | 4  | backfillRace | placeHeldDaysが無いエンティティを含む | placeHeldDaysMapにそのplaceIdは含まれない | Branch |
 */

import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';
import {
    type GradeType,
    type LocationCode,
    RaceType,
} from '@race-schedule/core';
import { PlaceFactory } from '../../../../../../tests/shared/factories';
import type { IBackfillRepository } from '../../../../src/repository/interface/IBackfillRepository';
import type { IPlaceRepository } from '../../../../src/repository/interface/IPlaceRepository';
import { BackfillUsecase } from '../../../../src/usecase/implement/backfillUsecase';

describe('BackfillUsecase', () => {
    const filter = {
        startDate: new Date('2026-01-01'),
        finishDate: new Date('2026-01-31'),
        raceTypeList: [RaceType.KEIRIN],
    };

    it('#1: backfillPlace はcacheOnly:true付きでBackfillRepository.syncPlaceを呼ぶ', async () => {
        const syncPlaceMock = mock(() =>
            Promise.resolve({
                successCount: 1,
                failureCount: 0,
                failures: [],
                notCachedKeys: [],
            }),
        );
        const backfillRepository: IBackfillRepository = {
            syncPlace: syncPlaceMock,
            syncRace: mock(),
        };
        const placeRepository: IPlaceRepository = {
            fetch: mock(() => Promise.resolve([])),
            upsert: mock(),
        };
        const usecase = new BackfillUsecase(
            placeRepository,
            backfillRepository,
        );

        const result = await usecase.backfillPlace(filter);

        expect(syncPlaceMock).toHaveBeenCalledWith({
            startDate: filter.startDate,
            finishDate: filter.finishDate,
            raceTypeList: filter.raceTypeList,
            cacheOnly: true,
        });
        expect(result.successCount).toBe(1);
    });

    it('#2: backfillRace はPlaceRepository.fetchが0件の場合BackfillRepository.syncRaceを呼ばず空結果を返す', async () => {
        const syncRaceMock = mock();
        const backfillRepository: IBackfillRepository = {
            syncPlace: mock(),
            syncRace: syncRaceMock,
        };
        const placeRepository: IPlaceRepository = {
            fetch: mock(() => Promise.resolve([])),
            upsert: mock(),
        };
        const usecase = new BackfillUsecase(
            placeRepository,
            backfillRepository,
        );

        const result = await usecase.backfillRace(filter);

        expect(syncRaceMock).not.toHaveBeenCalled();
        expect(result).toEqual({
            successCount: 0,
            failureCount: 0,
            failures: [],
            notCachedPlaceIds: [],
        });
    });

    it('#3: backfillRace はplaceIdList・placeHeldDaysMapを組み立ててsyncRaceを呼ぶ', async () => {
        const placeWithHeldDays = PlaceFactory.create({
            raceType: RaceType.JRA,
            placeHeldDays: { heldTimes: 1, heldDayTimes: 2 },
        });
        const syncRaceMock = mock(() =>
            Promise.resolve({
                successCount: 1,
                failureCount: 0,
                failures: [],
                notCachedPlaceIds: [],
            }),
        );
        const backfillRepository: IBackfillRepository = {
            syncPlace: mock(),
            syncRace: syncRaceMock,
        };
        const placeRepository: IPlaceRepository = {
            fetch: mock(() => Promise.resolve([placeWithHeldDays])),
            upsert: mock(),
        };
        const usecase = new BackfillUsecase(
            placeRepository,
            backfillRepository,
        );

        const result = await usecase.backfillRace(filter);

        expect(syncRaceMock).toHaveBeenCalledWith({
            placeIdList: [placeWithHeldDays.placeId],
            placeHeldDaysMap: {
                [placeWithHeldDays.placeId]: placeWithHeldDays.placeHeldDays,
            },
            cacheOnly: true,
        });
        expect(result.successCount).toBe(1);
    });

    it('#4: backfillRace はplaceHeldDaysが無いエンティティをplaceHeldDaysMapに含めない', async () => {
        const placeWithoutHeldDays = PlaceFactory.create({
            raceType: RaceType.KEIRIN,
            locationCode: '11' as LocationCode,
            placeGrade: 'GⅠ' as GradeType,
        });
        const syncRaceMock = mock(() =>
            Promise.resolve({
                successCount: 1,
                failureCount: 0,
                failures: [],
                notCachedPlaceIds: [],
            }),
        );
        const backfillRepository: IBackfillRepository = {
            syncPlace: mock(),
            syncRace: syncRaceMock,
        };
        const placeRepository: IPlaceRepository = {
            fetch: mock(() => Promise.resolve([placeWithoutHeldDays])),
            upsert: mock(),
        };
        const usecase = new BackfillUsecase(
            placeRepository,
            backfillRepository,
        );

        await usecase.backfillRace(filter);

        expect(syncRaceMock).toHaveBeenCalledWith({
            placeIdList: [placeWithoutHeldDays.placeId],
            placeHeldDaysMap: {},
            cacheOnly: true,
        });
    });
});
