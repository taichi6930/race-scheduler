/**
 * MainApiRepository テスト
 *
 * ## デシジョンテーブル
 *
 * | #  | 条件                          | 期待される動作                                             | Coverage |
 * |----|-------------------------------|------------------------------------------------------------|----------|
 * | 1  | fetchFeatureFlagList 呼び出し | gateway.fetchFeatureFlagList へ委譲し結果を返す             | Line     |
 * | 2  | updateFeatureFlag 呼び出し    | gateway.updateFeatureFlag へkey/enabledを渡して委譲し結果を返す | Line     |
 * | 3  | backfillPlace 呼び出し        | gateway.backfillPlace へfilterを渡して委譲し結果を返す       | Line     |
 * | 4  | backfillRace 呼び出し         | gateway.backfillRace へfilterを渡して委譲し結果を返す        | Line     |
 * | 5  | fetchUiLayout 呼び出し        | gateway.fetchUiLayout へraceTypeを渡して委譲し結果を返す      | Line     |
 * | 6  | saveUiLayout 呼び出し         | gateway.saveUiLayout へraceType/configを渡して委譲し結果を返す | Line    |
 * | 7  | previewUiLayout 呼び出し      | gateway.previewUiLayout へconfig/raceIdを渡して委譲し結果を返す | Line   |
 * | 8  | fetchReleaseNotes 呼び出し    | gateway.fetchReleaseNotes へ委譲し結果を返す                 | Line     |
 * | 9  | issueInvite 呼び出し          | gateway.issueInvite へmemoを渡して委譲し結果を返す           | Line     |
 * | 10 | fetchParticipants 呼び出し    | gateway.fetchParticipants へ委譲し結果を返す                 | Line     |
 * | 11 | fetchJoinRequests 呼び出し    | gateway.fetchJoinRequests へ委譲し結果を返す                 | Line     |
 * | 12 | approveJoinRequest 呼び出し   | gateway.approveJoinRequest へidを渡して委譲する              | Line     |
 * | 13 | rejectJoinRequest 呼び出し    | gateway.rejectJoinRequest へidを渡して委譲する               | Line     |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';

import { type RaceDetailUiConfig, RaceType } from '@race-schedule/core';

import type { BackfillFilter } from '../../../../src/dto/backfillResult';
import type { FeatureFlagStatus } from '../../../../src/dto/featureFlagStatus';
import type { IMainApiGateway } from '../../../../src/gateway/interface/IMainApiGateway';
import { MainApiRepository } from '../../../../src/repository/implement/mainApiRepository';

const SAMPLE_FLAGS: FeatureFlagStatus[] = [
    {
        key: 'announcement_banner',
        label: '起動時お知らせバナー',
        storedEnabled: true,
        envDefault: false,
        effectiveEnabled: true,
        updatedAt: '2026-08-07T00:00:00.000Z',
    },
];

const createRepository = (flags: FeatureFlagStatus[] = SAMPLE_FLAGS) => {
    const mainApiGateway: IMainApiGateway = {
        fetchFeatureFlagList: mock(() => Promise.resolve(flags)),
        updateFeatureFlag: mock(() => Promise.resolve(flags)),
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
        fetchJoinRequests: mock(() => Promise.resolve([])),
        approveJoinRequest: mock(() => Promise.resolve()),
        rejectJoinRequest: mock(() => Promise.resolve()),
    };

    return {
        mainApiGateway,
        repository: new MainApiRepository(mainApiGateway),
    };
};

describe('MainApiRepository', () => {
    it('#1: fetchFeatureFlagListはgatewayへ委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();

        const result = await repository.fetchFeatureFlagList();

        expect(mainApiGateway.fetchFeatureFlagList).toHaveBeenCalled();
        expect(result).toEqual(SAMPLE_FLAGS);
    });

    it('#2: updateFeatureFlagはgatewayへkey/enabledを渡して委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();

        const result = await repository.updateFeatureFlag(
            'announcement_banner',
            true,
        );

        expect(mainApiGateway.updateFeatureFlag).toHaveBeenCalledWith(
            'announcement_banner',
            true,
        );
        expect(result).toEqual(SAMPLE_FLAGS);
    });

    it('#3: backfillPlaceはgatewayへfilterを渡して委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();
        const filter: BackfillFilter = {
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: ['keirin'],
        };

        const result = await repository.backfillPlace(filter);

        expect(mainApiGateway.backfillPlace).toHaveBeenCalledWith(filter);
        expect(result.notCachedKeys).toEqual([]);
    });

    it('#4: backfillRaceはgatewayへfilterを渡して委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();
        const filter: BackfillFilter = {
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: ['keirin'],
        };

        const result = await repository.backfillRace(filter);

        expect(mainApiGateway.backfillRace).toHaveBeenCalledWith(filter);
        expect(result.notCachedPlaceIds).toEqual([]);
    });

    it('#5: fetchUiLayoutはgatewayへraceTypeを渡して委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();

        const result = await repository.fetchUiLayout(RaceType.KEIRIN);

        expect(mainApiGateway.fetchUiLayout).toHaveBeenCalledWith(
            RaceType.KEIRIN,
        );
        expect(result).toEqual({ sections: [] });
    });

    it('#6: saveUiLayoutはgatewayへraceType/configを渡して委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();
        const config: RaceDetailUiConfig = { sections: [] };

        const result = await repository.saveUiLayout(RaceType.KEIRIN, config);

        expect(mainApiGateway.saveUiLayout).toHaveBeenCalledWith(
            RaceType.KEIRIN,
            config,
        );
        expect(result).toEqual({ sections: [] });
    });

    it('#7: previewUiLayoutはgatewayへconfig/raceIdを渡して委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();
        const config: RaceDetailUiConfig = { sections: [] };

        const result = await repository.previewUiLayout(
            config,
            'keirin202608021036',
        );

        expect(mainApiGateway.previewUiLayout).toHaveBeenCalledWith(
            config,
            'keirin202608021036',
        );
        expect(result).toBeUndefined();
    });

    it('#8: fetchReleaseNotesはgatewayへ委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();

        const result = await repository.fetchReleaseNotes();

        expect(mainApiGateway.fetchReleaseNotes).toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    it('#9: issueInviteはgatewayへmemoを渡して委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();

        const result = await repository.issueInvite('テストメモ');

        expect(mainApiGateway.issueInvite).toHaveBeenCalledWith('テストメモ');
        expect(result).toEqual({ token: 'invite-token' });
    });

    it('#10: fetchParticipantsはgatewayへ委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();

        const result = await repository.fetchParticipants();

        expect(mainApiGateway.fetchParticipants).toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    it('#11: fetchJoinRequestsはgatewayへ委譲し結果を返す', async () => {
        const { mainApiGateway, repository } = createRepository();

        const result = await repository.fetchJoinRequests();

        expect(mainApiGateway.fetchJoinRequests).toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    it('#12: approveJoinRequestはgatewayへidを渡して委譲する', async () => {
        const { mainApiGateway, repository } = createRepository();

        await repository.approveJoinRequest('request-1');

        expect(mainApiGateway.approveJoinRequest).toHaveBeenCalledWith(
            'request-1',
        );
    });

    it('#13: rejectJoinRequestはgatewayへidを渡して委譲する', async () => {
        const { mainApiGateway, repository } = createRepository();

        await repository.rejectJoinRequest('request-1');

        expect(mainApiGateway.rejectJoinRequest).toHaveBeenCalledWith(
            'request-1',
        );
    });
});
