/**
 * FeatureFlagsUsecase テスト
 *
 * ## デシジョンテーブル
 *
 * | #  | 条件                | 期待される動作                                       | Coverage |
 * |----|---------------------|--------------------------------------------------------|----------|
 * | 1  | list 呼び出し       | repository.fetchFeatureFlagList へ委譲し結果を返す      | Line     |
 * | 2  | setFlag 呼び出し    | repository.updateFeatureFlag へkey/enabledを渡して委譲し結果を返す | Line |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';

import type { FeatureFlagStatus } from '../../../../src/dto/featureFlagStatus';
import type { IMainApiRepository } from '../../../../src/repository/interface/IMainApiRepository';
import { FeatureFlagsUsecase } from '../../../../src/usecase/implement/featureFlagsUsecase';

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

const createUsecase = (flags: FeatureFlagStatus[] = SAMPLE_FLAGS) => {
    const mainApiRepository: IMainApiRepository = {
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
    };

    return {
        mainApiRepository,
        usecase: new FeatureFlagsUsecase(mainApiRepository),
    };
};

describe('FeatureFlagsUsecase', () => {
    it('#1: listはrepositoryへ委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.list();

        expect(mainApiRepository.fetchFeatureFlagList).toHaveBeenCalled();
        expect(result).toEqual(SAMPLE_FLAGS);
    });

    it('#2: setFlagはrepositoryへkey/enabledを渡して委譲し結果を返す', async () => {
        const { mainApiRepository, usecase } = createUsecase();

        const result = await usecase.setFlag('announcement_banner', true);

        expect(mainApiRepository.updateFeatureFlag).toHaveBeenCalledWith(
            'announcement_banner',
            true,
        );
        expect(result).toEqual(SAMPLE_FLAGS);
    });
});
