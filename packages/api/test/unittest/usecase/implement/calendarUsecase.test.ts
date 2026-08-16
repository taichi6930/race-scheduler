/**
 * @spec SPEC-PLAYER-001
 *
 * ディシジョンテーブル
 * | 種別   | メソッド | 条件                                    | expected                              | 説明                                     |
 * |-------|---------|----------------------------------------|----------------------------------------|-------------------------------------------|
 * | 正常系 | fetch   | 該当レースあり（グレード対象）           | isFlagged/isWatched付きで返す           | raceRepository.fetch + フラグ結合          |
 * | 正常系 | fetch   | 該当レースなし                           | []                                     | レースなしの場合                            |
 * | 正常系 | fetch   | 全レース対象外（フィルタ落ち）           | []                                     | shouldIncludeInCalendarでフィルタ落ち       |
 * | 正常系 | fetch   | flaggedRaceIdsに含まれるがグレード対象外 | フィルタを通過しisFlagged:trueで含まれる | 指定レースフラグによる登録                   |
 * | 正常系 | fetch   | watchedRaceIdsに含まれるがグレード対象外 | フィルタを通過しisWatched:trueで含まれる | SPEC-PLAYER-001: 注目選手による自動判定    |
 * | 正常系 | fetch   | グレード対象だがフラグ・注目いずれもなし  | isFlagged:false/isWatched:falseで含まれる | -                                        |
 * | 正常系 | fetch   | -                                       | fetchFlaggedRaceIds/fetchWatchedRaceIdsをraceRepository.fetch結果のraceIdのみで呼ぶ | PERF-179: 全件取得ではなくIN句相当に絞り込む |
 * | 正常系 | listFlags | -                                     | CalendarFlagEntity[]                   | flagRepository.listに委譲                  |
 * | 正常系 | addFlag | raceId, label                          | flagRepository.addを呼ぶのみ            | Google Calendarへの即時反映は行わない        |
 * | 正常系 | removeFlag | raceId                              | flagRepository.removeを呼ぶのみ         | Google Calendarからの即時削除は行わない      |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type {
    CalendarFilterParams,
    CalendarFlagEntity,
    RaceNumber,
} from '@race-schedule/core';
import { RaceType, validateRaceId } from '@race-schedule/core';
import { container } from 'tsyringe';
import { RaceFactory } from '../../../../../../tests/shared/factories';
import { CalendarUsecase } from '../../../../src/usecase/implement/calendarUsecase';
import type { ICalendarUsecase } from '../../../../src/usecase/interface/ICalendarUsecase';
import {
    assertCalledWith,
    clearMocks,
    type TestRepositorySetup,
} from '../../../common';
import { setupTestRepositoryMock } from '../../../testSetupHelper';

describe('CalendarUsecase', () => {
    let usecase: ICalendarUsecase;
    let repositorySetup: TestRepositorySetup;

    beforeEach(() => {
        repositorySetup = setupTestRepositoryMock();
        usecase = container.resolve(CalendarUsecase);
    });

    afterEach(() => {
        clearMocks();
    });

    const FILTER: CalendarFilterParams = {
        startDate: new Date('2025-01-01'),
        finishDate: new Date('2025-01-31'),
        raceTypeList: [RaceType.JRA],
    };

    describe('fetch', () => {
        it('グレード対象のレースはisFlagged:falseで返ること（未フラグ）', async () => {
            const race = RaceFactory.create({ overrides: { raceGrade: 'GⅠ' } });
            repositorySetup.raceRepository.fetch.mockResolvedValue([race]);
            repositorySetup.calendarRepository.fetchFlaggedRaceIds.mockResolvedValue(
                new Set(),
            );
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                new Set(),
            );

            const result = await usecase.fetch(FILTER);

            expect(result).toHaveLength(1);
            expect(result[0].raceId).toBe(race.raceId);
            expect(result[0].isFlagged).toBe(false);
        });

        it('PERF-179: raceRepository.fetchが返したraceIdのみでfetchFlaggedRaceIdsを呼ぶこと', async () => {
            const race = RaceFactory.create({ overrides: { raceGrade: 'GⅠ' } });
            repositorySetup.raceRepository.fetch.mockResolvedValue([race]);
            repositorySetup.calendarRepository.fetchFlaggedRaceIds.mockResolvedValue(
                new Set(),
            );
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                new Set(),
            );

            await usecase.fetch(FILTER);

            assertCalledWith(
                repositorySetup.calendarRepository.fetchFlaggedRaceIds,
                [race.raceId],
            );
        });

        it('レースが存在しない場合は空配列を返すこと', async () => {
            repositorySetup.raceRepository.fetch.mockResolvedValue([]);
            repositorySetup.calendarRepository.fetchFlaggedRaceIds.mockResolvedValue(
                new Set(),
            );
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                new Set(),
            );

            const result = await usecase.fetch(FILTER);

            expect(result).toEqual([]);
        });

        it('shouldIncludeInCalendarに該当しないレースのみの場合は空配列を返すこと', async () => {
            const race = RaceFactory.create({
                overrides: { raceGrade: '未勝利' },
            });
            repositorySetup.raceRepository.fetch.mockResolvedValue([race]);
            repositorySetup.calendarRepository.fetchFlaggedRaceIds.mockResolvedValue(
                new Set(),
            );
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                new Set(),
            );

            const result = await usecase.fetch(FILTER);

            expect(result).toEqual([]);
        });

        it('flaggedRaceIdsに含まれるがグレード対象外のレースはisFlagged:trueで含まれること', async () => {
            const race = RaceFactory.create({
                overrides: { raceGrade: '未勝利' },
            });
            repositorySetup.raceRepository.fetch.mockResolvedValue([race]);
            repositorySetup.calendarRepository.fetchFlaggedRaceIds.mockResolvedValue(
                new Set([race.raceId]),
            );
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                new Set(),
            );

            const result = await usecase.fetch(FILTER);

            expect(result).toHaveLength(1);
            expect(result[0].isFlagged).toBe(true);
            expect(result[0].isWatched).toBe(false);
        });

        it('watchedRaceIdsに含まれるがグレード対象外のレースはisWatched:trueで含まれること（SPEC-PLAYER-001）', async () => {
            const race = RaceFactory.create({
                overrides: { raceGrade: '未勝利' },
            });
            repositorySetup.raceRepository.fetch.mockResolvedValue([race]);
            repositorySetup.calendarRepository.fetchFlaggedRaceIds.mockResolvedValue(
                new Set(),
            );
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                new Set([race.raceId]),
            );

            const result = await usecase.fetch(FILTER);

            expect(result).toHaveLength(1);
            expect(result[0].isFlagged).toBe(false);
            expect(result[0].isWatched).toBe(true);
        });

        it('PERF-179: raceRepository.fetchが返したraceIdのみでfetchWatchedRaceIdsを呼ぶこと', async () => {
            const race = RaceFactory.create({ overrides: { raceGrade: 'GⅠ' } });
            repositorySetup.raceRepository.fetch.mockResolvedValue([race]);
            repositorySetup.calendarRepository.fetchFlaggedRaceIds.mockResolvedValue(
                new Set(),
            );
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                new Set(),
            );

            await usecase.fetch(FILTER);

            assertCalledWith(
                repositorySetup.raceRepository.fetchWatchedRaceIds,
                [race.raceId],
            );
        });

        it('複数レースの混在リストで、対象外×未フラグのみ除外され、残りの中身・isFlagged・順序が正しく維持されること', async () => {
            const eligibleUnflagged = RaceFactory.create({
                raceNumber: 1 as RaceNumber,
                overrides: { raceGrade: 'GⅠ' },
            });
            const notEligibleUnflagged = RaceFactory.create({
                raceNumber: 2 as RaceNumber,
                overrides: { raceGrade: '未勝利' },
            });
            const notEligibleFlagged = RaceFactory.create({
                raceNumber: 3 as RaceNumber,
                overrides: { raceGrade: '未勝利' },
            });
            const eligibleFlagged = RaceFactory.create({
                raceNumber: 4 as RaceNumber,
                overrides: { raceGrade: 'GⅠ' },
            });

            repositorySetup.raceRepository.fetch.mockResolvedValue([
                eligibleUnflagged,
                notEligibleUnflagged,
                notEligibleFlagged,
                eligibleFlagged,
            ]);
            repositorySetup.calendarRepository.fetchFlaggedRaceIds.mockResolvedValue(
                new Set([notEligibleFlagged.raceId, eligibleFlagged.raceId]),
            );
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                new Set(),
            );

            const result = await usecase.fetch(FILTER);

            // notEligibleUnflagged だけが除外され、残り3件は元の順序を保ったまま返る
            expect(result.map((r) => r.raceId)).toEqual([
                eligibleUnflagged.raceId,
                notEligibleFlagged.raceId,
                eligibleFlagged.raceId,
            ]);
            expect(
                result.find((r) => r.raceId === eligibleUnflagged.raceId)
                    ?.isFlagged,
            ).toBe(false);
            expect(
                result.find((r) => r.raceId === notEligibleFlagged.raceId)
                    ?.isFlagged,
            ).toBe(true);
            expect(
                result.find((r) => r.raceId === eligibleFlagged.raceId)
                    ?.isFlagged,
            ).toBe(true);
        });
    });

    describe('listFlags', () => {
        it('flagRepository.listの結果をそのまま返すこと', async () => {
            const flags: CalendarFlagEntity[] = [];
            repositorySetup.calendarRepository.list.mockResolvedValue(flags);

            const result = await usecase.listFlags();

            expect(result).toBe(flags);
        });
    });

    describe('addFlag', () => {
        it('flagRepository.addのみを呼び出すこと', async () => {
            const raceId = validateRaceId('jra202601270501');
            await usecase.addFlag(raceId, 'メモ');

            assertCalledWith(
                repositorySetup.calendarRepository.add,
                raceId,
                'メモ',
            );
        });
    });

    describe('removeFlag', () => {
        it('flagRepository.removeのみを呼び出すこと', async () => {
            const raceId = validateRaceId('jra202601270501');
            await usecase.removeFlag(raceId);

            assertCalledWith(repositorySetup.calendarRepository.remove, raceId);
        });
    });
});
