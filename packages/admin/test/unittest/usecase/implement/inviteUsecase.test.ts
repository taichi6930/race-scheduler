/**
 * InviteUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件                    | 期待される動作                                    | Coverage |
 * |---|-------------------------|-----------------------------------------------------|----------|
 * | 1 | issueInvite 呼び出し    | repository.issueInvite へmemoを渡して委譲し結果を返す | Line   |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';

import type { InviteIssueResult } from '../../../../src/dto/invite';
import type { IMainApiRepository } from '../../../../src/repository/interface/IMainApiRepository';
import { InviteUsecase } from '../../../../src/usecase/implement/inviteUsecase';

const SAMPLE_RESULT: InviteIssueResult = { token: 'invite-token' };

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
        issueInvite: mock(() => Promise.resolve(SAMPLE_RESULT)),
        fetchParticipants: mock(() => Promise.resolve([])),
        fetchJoinRequests: mock(() => Promise.resolve([])),
        approveJoinRequest: mock(() => Promise.resolve()),
        rejectJoinRequest: mock(() => Promise.resolve()),
    };

    return {
        mainApiRepository,
        usecase: new InviteUsecase(mainApiRepository),
    };
};

describe('InviteUsecase', () => {
    it('#1: issueInviteはrepositoryへmemoを渡して委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.issueInvite('テストメモ');

        expect(mainApiRepository.issueInvite).toHaveBeenCalledWith(
            'テストメモ',
        );
        expect(result).toEqual(SAMPLE_RESULT);
    });
});
