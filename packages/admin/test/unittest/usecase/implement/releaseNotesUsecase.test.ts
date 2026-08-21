/**
 * ReleaseNotesUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | #  | 条件          | 期待される動作                                   | Coverage |
 * |----|---------------|-----------------------------------------------------|----------|
 * | 1  | list 呼び出し | repository.fetchReleaseNotes へ委譲し結果を返す      | Line     |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';
import type { ReleaseNote } from '@race-schedule/core';

import type { IMainApiRepository } from '../../../../src/repository/interface/IMainApiRepository';
import { ReleaseNotesUsecase } from '../../../../src/usecase/implement/releaseNotesUsecase';

const SAMPLE_NOTES: ReleaseNote[] = [
    {
        tag_name: 'v1.0.0',
        name: 'v1.0.0',
        body: '本文',
        published_at: '2026-08-16T00:00:00Z',
        draft: false,
        prerelease: false,
        source_repo: 'race-schedule',
    },
];

const createUsecase = (notes: ReleaseNote[] = SAMPLE_NOTES) => {
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
        fetchReleaseNotes: mock(() => Promise.resolve(notes)),
        issueInvite: mock(() => Promise.resolve({ token: 'invite-token' })),
        fetchParticipants: mock(() => Promise.resolve([])),
        fetchJoinRequests: mock(() => Promise.resolve([])),
        approveJoinRequest: mock(() => Promise.resolve()),
        rejectJoinRequest: mock(() => Promise.resolve()),
    };

    return {
        mainApiRepository,
        usecase: new ReleaseNotesUsecase(mainApiRepository),
    };
};

describe('ReleaseNotesUsecase', () => {
    it('#1: listはrepositoryへ委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.list();

        expect(mainApiRepository.fetchReleaseNotes).toHaveBeenCalled();
        expect(result).toEqual(SAMPLE_NOTES);
    });
});
