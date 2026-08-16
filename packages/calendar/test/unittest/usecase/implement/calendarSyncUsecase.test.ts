/**
 * CalendarSyncUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件 | 期待される動作 | Coverage |
 *----|------|----------------|----------|
 * | 1 | 正常系（対象レースあり） | フィルタ後のレースでupsert・cleanseStaleEventsを呼び、集計結果を返す | Line |
 * | 2 | shouldIncludeInCalendarに該当しないレースのみ | upsert/cleanseStaleEventsには空配列が渡る | Branch |
 * | 3 | flaggedRaceIdsに含まれるがグレード対象外のレース | フィルタを通過してupsertに渡る | Branch |
 * | 4 | upsertがupdatedCount、cleanseがdeletedCount/failureCountを返す | successCount/failureCount/failuresがupsert・cleanse結果の合算になる | Line |
 * | 5 | mainApiRepository.fetchRaceListがreject | 例外が呼び出し元へ伝播する | Branch |
 * | 6 | calendarRepository.upsertが想定外の例外でreject（OBS-008） | 例外を投げず、cleanseの結果は保持したままupsert側をfailureCount1として返す | Branch |
 * | 7 | calendarRepository.cleanseStaleEventsが想定外の例外でreject（OBS-008） | 例外を投げず、upsertの結果は保持したままcleanse側をfailureCount1として返す | Branch |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';
import type {
    CalendarFilterParams,
    CalendarFlagEntity,
    CalendarUpsertResult,
    RaceEntity,
} from '@race-schedule/core';
import { createEmptyCalendarUpsertResult, RaceType } from '@race-schedule/core';
import { RaceFactory } from '../../../../../../tests/shared/factories';
import type { ICalendarRepository } from '../../../../src/repository/interface/ICalendarRepository';
import type { IMainApiRepository } from '../../../../src/repository/interface/IMainApiRepository';
import { CalendarSyncUsecase } from '../../../../src/usecase/implement/calendarSyncUsecase';

interface CreateUsecaseOptions {
    upsertResult?: Partial<CalendarUpsertResult>;
    cleanseResult?: Partial<CalendarUpsertResult>;
    fetchRaceListError?: Error;
    upsertError?: Error;
    cleanseError?: Error;
}

const createUsecase = (
    raceEntityList: RaceEntity[],
    flaggedRaceIds: CalendarFlagEntity[] = [],
    options: CreateUsecaseOptions = {},
) => {
    const mainApiRepository: IMainApiRepository = {
        fetchRaceList: mock(() =>
            options.fetchRaceListError
                ? Promise.reject(options.fetchRaceListError)
                : Promise.resolve(raceEntityList),
        ),
        fetchCalendarFlagList: mock(() => Promise.resolve(flaggedRaceIds)),
    };
    const calendarRepository: ICalendarRepository = {
        fetch: mock(() => Promise.resolve([])),
        upsert: mock(() =>
            options.upsertError
                ? Promise.reject(options.upsertError)
                : Promise.resolve({
                      ...createEmptyCalendarUpsertResult(),
                      insertedCount: 1,
                      ...options.upsertResult,
                  }),
        ),
        cleanseStaleEvents: mock(() =>
            options.cleanseError
                ? Promise.reject(options.cleanseError)
                : Promise.resolve({
                      ...createEmptyCalendarUpsertResult(),
                      ...options.cleanseResult,
                  }),
        ),
        deleteById: mock(() => Promise.resolve()),
    };
    return {
        mainApiRepository,
        calendarRepository,
        usecase: new CalendarSyncUsecase(mainApiRepository, calendarRepository),
    };
};

const FILTER: CalendarFilterParams = {
    startDate: new Date('2026-01-01T00:00:00+09:00'),
    finishDate: new Date('2026-01-31T00:00:00+09:00'),
    raceTypeList: [RaceType.JRA],
};

describe('CalendarSyncUsecase', () => {
    it('#1: 対象レースありの場合、フィルタ後のレースでupsert・cleanseStaleEventsを呼び集計結果を返す', async () => {
        const race = RaceFactory.create({ overrides: { raceGrade: 'GⅠ' } });
        const { calendarRepository, usecase } = createUsecase([race]);

        const result = await usecase.sync(FILTER);

        expect(calendarRepository.upsert).toHaveBeenCalledWith(FILTER, [race]);
        expect(calendarRepository.cleanseStaleEvents).toHaveBeenCalledWith(
            FILTER,
            [race],
            [race],
        );
        expect(result.successCount).toBe(1);
        expect(result.insertedCount).toBe(1);
    });

    it('#2: shouldIncludeInCalendarに該当しないレースのみの場合、空配列がupsertに渡る', async () => {
        const race = RaceFactory.create({
            overrides: { raceGrade: '未勝利' },
        });
        const { calendarRepository, usecase } = createUsecase([race]);

        await usecase.sync(FILTER);

        expect(calendarRepository.upsert).toHaveBeenCalledWith(FILTER, []);
    });

    it('#3: flaggedRaceIdsに含まれるがグレード対象外のレースはフィルタを通過する', async () => {
        const race = RaceFactory.create({
            overrides: { raceGrade: '未勝利' },
        });
        const { calendarRepository, usecase } = createUsecase(
            [race],
            [{ raceId: race.raceId, label: 'メモ' }],
        );

        await usecase.sync(FILTER);

        expect(calendarRepository.upsert).toHaveBeenCalledWith(FILTER, [race]);
    });

    it('#4: upsertがupdatedCount、cleanseがdeletedCount/failureCountを返す場合successCount・failureCount・failuresを合算する', async () => {
        const race = RaceFactory.create({ overrides: { raceGrade: 'GⅠ' } });
        const { usecase } = createUsecase([race], [], {
            upsertResult: {
                insertedCount: 1,
                updatedCount: 2,
                failureCount: 1,
                failures: [{ id: 'upsert-fail', reason: 'upsert error' }],
            },
            cleanseResult: {
                deletedCount: 3,
                failureCount: 1,
                failures: [{ id: 'cleanse-fail', reason: 'cleanse error' }],
            },
        });

        const result = await usecase.sync(FILTER);

        expect(result.insertedCount).toBe(1);
        expect(result.updatedCount).toBe(2);
        expect(result.deletedCount).toBe(3);
        // successCount = insertedCount + updatedCount + deletedCount の合算
        expect(result.successCount).toBe(6);
        // failureCount は upsert・cleanse それぞれの failureCount の合算
        expect(result.failureCount).toBe(2);
        // failures は upsert・cleanse の失敗一覧を連結したもの
        expect(result.failures).toEqual([
            { id: 'upsert-fail', reason: 'upsert error' },
            { id: 'cleanse-fail', reason: 'cleanse error' },
        ]);
    });

    it('#5: mainApiRepository.fetchRaceListがrejectした場合例外が呼び出し元へ伝播する', async () => {
        const fetchError = new Error('fetchRaceList failed');
        const { usecase } = createUsecase([], [], {
            fetchRaceListError: fetchError,
        });

        await expect(usecase.sync(FILTER)).rejects.toThrow(
            'fetchRaceList failed',
        );
    });

    it('#6: calendarRepository.upsertが想定外の例外でrejectした場合、cleanseの結果を保持したままupsert側をfailureCount1として返す', async () => {
        const race = RaceFactory.create({ overrides: { raceGrade: 'GⅠ' } });
        const upsertError = new Error('upsert crashed');
        const { calendarRepository, usecase } = createUsecase([race], [], {
            upsertError,
            cleanseResult: { deletedCount: 2 },
        });

        const result = await usecase.sync(FILTER);

        expect(calendarRepository.cleanseStaleEvents).toHaveBeenCalled();
        expect(result.insertedCount).toBe(0);
        expect(result.deletedCount).toBe(2);
        expect(result.failureCount).toBe(1);
        expect(result.failures).toEqual([
            {
                id: 'upsert',
                reason: expect.stringContaining('upsert crashed'),
            },
        ]);
    });

    it('#7: calendarRepository.cleanseStaleEventsが想定外の例外でrejectした場合、upsertの結果を保持したままcleanse側をfailureCount1として返す', async () => {
        const race = RaceFactory.create({ overrides: { raceGrade: 'GⅠ' } });
        const cleanseError = new Error('cleanse crashed');
        const { usecase } = createUsecase([race], [], {
            upsertResult: { insertedCount: 3 },
            cleanseError,
        });

        const result = await usecase.sync(FILTER);

        expect(result.insertedCount).toBe(3);
        expect(result.deletedCount).toBe(0);
        expect(result.failureCount).toBe(1);
        expect(result.failures).toEqual([
            {
                id: 'cleanseStaleEvents',
                reason: expect.stringContaining('cleanse crashed'),
            },
        ]);
    });
});
