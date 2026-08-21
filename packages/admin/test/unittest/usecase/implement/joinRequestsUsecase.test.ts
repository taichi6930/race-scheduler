/**
 * JoinRequestsUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件                | 期待される動作                                    | Coverage |
 * |---|---------------------|-----------------------------------------------------|----------|
 * | 1 | list 呼び出し       | repository.fetchJoinRequests へ委譲し結果を返す      | Line   |
 * | 2 | approve 呼び出し    | repository.approveJoinRequest へidを渡して委譲する   | Line   |
 * | 3 | reject 呼び出し     | repository.rejectJoinRequest へidを渡して委譲する    | Line   |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';

import type { JoinRequestSummary } from '../../../../src/dto/joinRequest';
import type { IMainApiRepository } from '../../../../src/repository/interface/IMainApiRepository';
import { JoinRequestsUsecase } from '../../../../src/usecase/implement/joinRequestsUsecase';

const SAMPLE_REQUESTS: JoinRequestSummary[] = [
    { id: 'request-1', nickname: 'にっくねーむ' },
];

const createUsecase = () => {
    const mainApiRepository: IMainApiRepository = {
        fetchFeatureFlagList: mock(() => Promise.resolve([])),
        updateFeatureFlag: mock(() => Promise.resolve([])),
        backfillPlace: mock(() =>
            Promise.resolve({
                successCount: 0,
                failureCount: 0,
                failures: [],
                notCachedKeys: [],
            }),
        ),
        backfillRace: mock(() =>
            Promise.resolve({
                successCount: 0,
                failureCount: 0,
                failures: [],
                notCachedPlaceIds: [],
            }),
        ),
        fetchUiLayout: mock(() => Promise.resolve({ sections: [] })),
        saveUiLayout: mock(() => Promise.resolve({ sections: [] })),
        previewUiLayout: mock(() => Promise.resolve(undefined)),
        fetchUpcomingKeirinRaces: mock(() => Promise.resolve([])),
        fetchReleaseNotes: mock(() => Promise.resolve([])),
        issueInvite: mock(() => Promise.resolve({ token: 'invite-token' })),
        fetchParticipants: mock(() => Promise.resolve([])),
        fetchJoinRequests: mock(() => Promise.resolve(SAMPLE_REQUESTS)),
        approveJoinRequest: mock(() => Promise.resolve()),
        rejectJoinRequest: mock(() => Promise.resolve()),
    };

    return {
        mainApiRepository,
        usecase: new JoinRequestsUsecase(mainApiRepository),
    };
};

describe('JoinRequestsUsecase', () => {
    it('#1: listはrepositoryへ委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.list();

        expect(mainApiRepository.fetchJoinRequests).toHaveBeenCalled();
        expect(result).toEqual(SAMPLE_REQUESTS);
    });

    it('#2: approveはrepositoryへidを渡して委譲する', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        await usecase.approve('request-1');

        expect(mainApiRepository.approveJoinRequest).toHaveBeenCalledWith(
            'request-1',
        );
    });

    it('#3: rejectはrepositoryへidを渡して委譲する', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        await usecase.reject('request-1');

        expect(mainApiRepository.rejectJoinRequest).toHaveBeenCalledWith(
            'request-1',
        );
    });
});
