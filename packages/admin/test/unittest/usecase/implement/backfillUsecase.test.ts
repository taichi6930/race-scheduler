/**
 * BackfillUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | #  | 条件                    | 期待される動作                                       | Coverage |
 * |----|-------------------------|--------------------------------------------------------|----------|
 * | 1  | backfillPlace 呼び出し | repository.backfillPlace へfilterを渡して委譲し結果を返す | Line     |
 * | 2  | backfillRace 呼び出し  | repository.backfillRace へfilterを渡して委譲し結果を返す  | Line     |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';

import type { BackfillFilter } from '../../../../src/dto/backfillResult';
import type { IMainApiRepository } from '../../../../src/repository/interface/IMainApiRepository';
import { BackfillUsecase } from '../../../../src/usecase/implement/backfillUsecase';

const SAMPLE_FILTER: BackfillFilter = {
    startDate: '2026-01-01',
    finishDate: '2026-01-31',
    raceTypeList: ['keirin'],
};

const createUsecase = () => {
    const mainApiRepository: IMainApiRepository = {
        fetchFeatureFlagList: mock(() => Promise.resolve([])),
        updateFeatureFlag: mock(() => Promise.resolve([])),
        backfillPlace: mock(() =>
            Promise.resolve({
                successCount: 1,
                failureCount: 0,
                failures: [],
                notCachedKeys: [],
            }),
        ),
        backfillRace: mock(() =>
            Promise.resolve({
                successCount: 0,
                failureCount: 1,
                failures: [],
                notCachedPlaceIds: ['place-1'],
            }),
        ),
        fetchUiLayout: mock(() => Promise.resolve({ sections: [] })),
        saveUiLayout: mock(() => Promise.resolve({ sections: [] })),
        previewUiLayout: mock(() => Promise.resolve(undefined)),
        fetchUpcomingKeirinRaces: mock(() => Promise.resolve([])),
        fetchReleaseNotes: mock(() => Promise.resolve([])),
        issueInvite: mock(() => Promise.resolve({ token: 'invite-token' })),
        fetchParticipants: mock(() => Promise.resolve([])),
    };

    return {
        mainApiRepository,
        usecase: new BackfillUsecase(mainApiRepository),
    };
};

describe('BackfillUsecase', () => {
    it('#1: backfillPlaceはrepositoryへfilterを渡して委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.backfillPlace(SAMPLE_FILTER);

        expect(mainApiRepository.backfillPlace).toHaveBeenCalledWith(
            SAMPLE_FILTER,
        );
        expect(result.successCount).toBe(1);
    });

    it('#2: backfillRaceはrepositoryへfilterを渡して委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.backfillRace(SAMPLE_FILTER);

        expect(mainApiRepository.backfillRace).toHaveBeenCalledWith(
            SAMPLE_FILTER,
        );
        expect(result.notCachedPlaceIds).toEqual(['place-1']);
    });
});
