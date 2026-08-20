/**
 * RaceDetailLayoutUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | #  | 条件                       | 期待される動作                                        | Coverage |
 * |----|----------------------------|---------------------------------------------------------|----------|
 * | 1  | getConfig 呼び出し         | repository.fetchUiLayout へraceTypeを渡して委譲し結果を返す | Line   |
 * | 2  | saveConfig 呼び出し        | repository.saveUiLayout へraceType/configを渡して委譲し結果を返す | Line |
 * | 3  | previewConfig 呼び出し     | repository.previewUiLayout へconfig/raceIdを渡して委譲し結果を返す | Line |
 * | 4  | listPreviewCandidates 呼び出し | repository.fetchUpcomingKeirinRaces へdaysを渡して委譲し、datetime昇順で返す | Line/Branch |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';
import { type RaceDetailUiConfig, RaceType } from '@race-schedule/core';

import type { RaceSummary } from '../../../../src/dto/raceSummary';
import type { IMainApiRepository } from '../../../../src/repository/interface/IMainApiRepository';
import { RaceDetailLayoutUsecase } from '../../../../src/usecase/implement/raceDetailLayoutUsecase';

const SAMPLE_CONFIG: RaceDetailUiConfig = {
    sections: [{ type: 'kv', fields: [{ key: 'time' }] }],
};

const UNSORTED_RACES: RaceSummary[] = [
    {
        raceId: 'keirin202608102',
        raceName: 'B',
        raceCourse: '大宮',
        raceNumber: 5,
        raceGrade: '',
        datetime: '2026-08-10T10:00:00+09:00',
    },
    {
        raceId: 'keirin202608091',
        raceName: 'A',
        raceCourse: '松戸',
        raceNumber: 3,
        raceGrade: '',
        datetime: '2026-08-09T10:00:00+09:00',
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
        fetchUiLayout: mock(() => Promise.resolve(SAMPLE_CONFIG)),
        saveUiLayout: mock(() => Promise.resolve(SAMPLE_CONFIG)),
        previewUiLayout: mock(() =>
            Promise.resolve({ schemaVersion: 1 as const, sections: [] }),
        ),
        fetchUpcomingKeirinRaces: mock(() => Promise.resolve(UNSORTED_RACES)),
        fetchReleaseNotes: mock(() => Promise.resolve([])),
        issueInvite: mock(() => Promise.resolve({ token: 'invite-token' })),
        fetchParticipants: mock(() => Promise.resolve([])),
    };

    return {
        mainApiRepository,
        usecase: new RaceDetailLayoutUsecase(mainApiRepository),
    };
};

describe('RaceDetailLayoutUsecase', () => {
    it('#1: getConfigはrepository.fetchUiLayoutへraceTypeを渡して委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.getConfig(RaceType.KEIRIN);

        expect(mainApiRepository.fetchUiLayout).toHaveBeenCalledWith(
            RaceType.KEIRIN,
        );
        expect(result).toEqual(SAMPLE_CONFIG);
    });

    it('#2: saveConfigはrepository.saveUiLayoutへraceType/configを渡して委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.saveConfig(RaceType.KEIRIN, SAMPLE_CONFIG);

        expect(mainApiRepository.saveUiLayout).toHaveBeenCalledWith(
            RaceType.KEIRIN,
            SAMPLE_CONFIG,
        );
        expect(result).toEqual(SAMPLE_CONFIG);
    });

    it('#3: previewConfigはrepository.previewUiLayoutへconfig/raceIdを渡して委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.previewConfig(SAMPLE_CONFIG, 'race-1');

        expect(mainApiRepository.previewUiLayout).toHaveBeenCalledWith(
            SAMPLE_CONFIG,
            'race-1',
        );
        expect(result).toEqual({ schemaVersion: 1, sections: [] });
    });

    it('#4: listPreviewCandidatesはrepository.fetchUpcomingKeirinRacesへdaysを渡して委譲し、datetime昇順で返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.listPreviewCandidates(14);

        expect(mainApiRepository.fetchUpcomingKeirinRaces).toHaveBeenCalledWith(
            14,
        );
        expect(result.map((race) => race.raceId)).toEqual([
            'keirin202608091',
            'keirin202608102',
        ]);
    });
});
