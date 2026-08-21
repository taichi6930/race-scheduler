/**
 * ParticipantsUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件            | 期待される動作                          | Coverage |
 * |---|-----------------|-------------------------------------------|----------|
 * | 1 | list 呼び出し   | repository.fetchParticipants へ委譲し結果を返す | Line |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';

import type { ParticipantSummary } from '../../../../src/dto/participant';
import type { IMainApiRepository } from '../../../../src/repository/interface/IMainApiRepository';
import { ParticipantsUsecase } from '../../../../src/usecase/implement/participantsUsecase';

const SAMPLE_PARTICIPANTS: ParticipantSummary[] = [
    {
        userId: 'user-1',
        nickname: 'にっくねーむ',
        inviteMemo: 'メモ',
        credentialId: 'credential-1',
        deviceLabel: 'iPhone',
        lastUsedAt: '2026-08-19T00:00:00.000Z',
        userCreatedAt: '2026-08-01T00:00:00.000Z',
    },
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
        fetchParticipants: mock(() => Promise.resolve(SAMPLE_PARTICIPANTS)),
        fetchJoinRequests: mock(() => Promise.resolve([])),
        approveJoinRequest: mock(() => Promise.resolve()),
        rejectJoinRequest: mock(() => Promise.resolve()),
    };

    return {
        mainApiRepository,
        usecase: new ParticipantsUsecase(mainApiRepository),
    };
};

describe('ParticipantsUsecase', () => {
    it('#1: listはrepositoryへ委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.list();

        expect(mainApiRepository.fetchParticipants).toHaveBeenCalled();
        expect(result).toEqual(SAMPLE_PARTICIPANTS);
    });
});
