/**
 * announcementUsecase.test.ts - AnnouncementUsecase ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | FeatureFlagUsecase.resolve()の結果 | 期待値                                          |
 * |---|--------------------------------------|--------------------------------------------------|
 * | 1 | true                                  | enabled:true・'announcement_banner'キーで呼ばれる |
 * | 2 | false                                 | enabled:false                                     |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';

import { AnnouncementUsecase } from '../../../../src/usecase/implement/announcementUsecase';
import type { IFeatureFlagUsecase } from '../../../../src/usecase/interface/IFeatureFlagUsecase';

interface MockFeatureFlagUsecase {
    resolve: Mock<IFeatureFlagUsecase['resolve']>;
    list: Mock<IFeatureFlagUsecase['list']>;
    setFlag: Mock<IFeatureFlagUsecase['setFlag']>;
}

const createMockFeatureFlagUsecase = (
    resolveResult: boolean,
): MockFeatureFlagUsecase => ({
    resolve: mock(() => Promise.resolve(resolveResult)),
    list: mock(() => Promise.resolve([])),
    setFlag: mock(() => Promise.resolve()),
});

describe('api/usecase/AnnouncementUsecase', () => {
    describe('getAnnouncement', () => {
        it('1: FeatureFlagUsecase.resolveがtrueの場合はenabled:trueを返し、announcement_bannerキーで呼ばれること', async () => {
            const featureFlagUsecase = createMockFeatureFlagUsecase(true);
            const usecase = new AnnouncementUsecase(featureFlagUsecase);

            const announcement = await usecase.getAnnouncement();

            expect(announcement.schemaVersion).toBe(1);
            expect(announcement.enabled).toBe(true);
            expect(typeof announcement.message).toBe('string');
            expect(announcement.message.length).toBeGreaterThan(0);
            expect(featureFlagUsecase.resolve).toHaveBeenCalledWith(
                'announcement_banner',
            );
        });

        it('2: FeatureFlagUsecase.resolveがfalseの場合はenabled:falseを返すこと', async () => {
            const featureFlagUsecase = createMockFeatureFlagUsecase(false);
            const usecase = new AnnouncementUsecase(featureFlagUsecase);

            const announcement = await usecase.getAnnouncement();

            expect(announcement.enabled).toBe(false);
        });
    });
});
