/**
 * DI Application層テスト
 *
 * アプリケーション層のDI設定が正しく登録されることを検証します。
 *
 * テスト対象：
 * - Usecase, Repository の登録
 * - 依存性注入が正しく機能すること
 *
 * @remarks
 * P2-1（test-quality-audit.md）: 以前は全ケースが`toBeDefined()`+`typeof==='object'`という
 * DI「劇場」テスト（何が解決されても通ってしまう検証）だったため、`toBeInstanceOf(具象クラス)`へ
 * 強化した。また、個別named testとデシジョンテーブル（DT-1〜4）がRepository 4種について
 * 完全に重複していたため、DTはUsecase側（named testで未検証だった対象）のみに絞って統合した。
 *
 * API-8: BatchLock・FeatureFlag・ReleaseNote・UiLayout・Auth・Favorite各domainのUsecase・Repositoryテストを追加。
 */
import 'reflect-metadata';

import { beforeEach, describe, expect, it } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import { registerInfrastructureForInMemory } from '../../../src/di/infrastructure';
import { BatchLockRepository } from '../../../src/repository/implement/batchLockRepository';
import { CalendarRepository } from '../../../src/repository/implement/calendarRepository';
import { FavoriteRepository } from '../../../src/repository/implement/favoriteRepository';
import { FeatureFlagRepository } from '../../../src/repository/implement/featureFlagRepository';
import { PlaceRepository } from '../../../src/repository/implement/placeRepository';
import { PlayerRepository } from '../../../src/repository/implement/playerRepository';
import { RaceRepository } from '../../../src/repository/implement/raceRepository';
import { ReleaseNoteRepository } from '../../../src/repository/implement/releaseNoteRepository';
import type { IBatchLockRepository } from '../../../src/repository/interface/IBatchLockRepository';
import type { ICalendarRepository } from '../../../src/repository/interface/ICalendarRepository';
import type { IFavoriteRepository } from '../../../src/repository/interface/IFavoriteRepository';
import type { IFeatureFlagRepository } from '../../../src/repository/interface/IFeatureFlagRepository';
import type { IPlaceRepository } from '../../../src/repository/interface/IPlaceRepository';
import type { IPlayerRepository } from '../../../src/repository/interface/IPlayerRepository';
import type { IRaceRepository } from '../../../src/repository/interface/IRaceRepository';
import type { IReleaseNoteRepository } from '../../../src/repository/interface/IReleaseNoteRepository';
import { AnnouncementUsecase } from '../../../src/usecase/implement/announcementUsecase';
import { AuthUsecase } from '../../../src/usecase/implement/authUsecase';
import { BatchLockUsecase } from '../../../src/usecase/implement/batchLockUsecase';
import { CalendarUsecase } from '../../../src/usecase/implement/calendarUsecase';
import { FavoriteUsecase } from '../../../src/usecase/implement/favoriteUsecase';
import { FeatureFlagUsecase } from '../../../src/usecase/implement/featureFlagUsecase';
import { PlaceUsecase } from '../../../src/usecase/implement/placeUsecase';
import { PlayerUsecase } from '../../../src/usecase/implement/playerUsecase';
import { RaceUsecase } from '../../../src/usecase/implement/raceUsecase';
import { ReleaseNoteUsecase } from '../../../src/usecase/implement/releaseNoteUsecase';
import { UiLayoutUsecase } from '../../../src/usecase/implement/uiLayoutUsecase';

describe('DI Application層', () => {
    beforeEach(() => {
        container.clearInstances();
        // インメモリデータベースをセットアップ
        process.env.USE_IN_MEMORY_DB = 'true';
        registerInfrastructureForInMemory();
    });

    describe('registerApplication', () => {
        it('アプリケーション層のコンポーネントが登録されること', () => {
            registerApplication();

            const calendarFlagRepo =
                container.resolve<ICalendarRepository>('CalendarRepository');
            const placeRepo =
                container.resolve<IPlaceRepository>('PlaceRepository');
            const playerRepo =
                container.resolve<IPlayerRepository>('PlayerRepository');
            const raceRepo =
                container.resolve<IRaceRepository>('RaceRepository');

            // 具象クラスとして解決されること（DIトークンの誤登録・差し替え漏れを検知）
            expect(calendarFlagRepo).toBeInstanceOf(CalendarRepository);
            expect(placeRepo).toBeInstanceOf(PlaceRepository);
            expect(playerRepo).toBeInstanceOf(PlayerRepository);
            expect(raceRepo).toBeInstanceOf(RaceRepository);
        });

        it('CalendarRepositoryが登録されること', () => {
            registerApplication();
            const calendarFlagRepo =
                container.resolve<ICalendarRepository>('CalendarRepository');
            expect(calendarFlagRepo).toBeInstanceOf(CalendarRepository);
        });

        it('PlaceRepositoryが登録されること', () => {
            registerApplication();
            const placeRepo =
                container.resolve<IPlaceRepository>('PlaceRepository');
            expect(placeRepo).toBeInstanceOf(PlaceRepository);
        });

        it('PlayerRepositoryが登録されること', () => {
            registerApplication();
            const playerRepo =
                container.resolve<IPlayerRepository>('PlayerRepository');
            expect(playerRepo).toBeInstanceOf(PlayerRepository);
        });

        it('RaceRepositoryが登録されること', () => {
            registerApplication();
            const raceRepo =
                container.resolve<IRaceRepository>('RaceRepository');
            expect(raceRepo).toBeInstanceOf(RaceRepository);
        });

        it('複数回呼び出しても安全であること', () => {
            registerApplication();
            registerApplication();
            const placeRepo =
                container.resolve<IPlaceRepository>('PlaceRepository');
            expect(placeRepo).toBeInstanceOf(PlaceRepository);
        });
    });

    describe('デシジョンテーブル: DI Application登録（Usecase）', () => {
        /**
         * DI Application層 デシジョンテーブル（Usecase）
         *
         * Repository 4種（Calendar/Place/Player/Race）は上の`registerApplication`
         * describeで named test として個別検証済みのため、ここではnamed testで
         * カバーしていないUsecase側のみを扱う（P2-1: 重複統合）。
         *
         * | # | コンポーネント | 登録前 | 登録後 | 解決可能 | 期待値                     |
         * |---|----------------|--------|--------|----------|----------------------------|
         * | 1 | CalendarUsecase | undefined | defined | ✓ | CalendarUsecaseのインスタンス |
         * | 2 | PlaceUsecase    | undefined | defined | ✓ | PlaceUsecaseのインスタンス    |
         * | 3 | PlayerUsecase   | undefined | defined | ✓ | PlayerUsecaseのインスタンス   |
         * | 4 | RaceUsecase     | undefined | defined | ✓ | RaceUsecaseのインスタンス     |
         */

        it('[DT-1] CalendarUsecase - 登録後に解決可能', () => {
            registerApplication();
            const usecase = container.resolve('CalendarUsecase');
            expect(usecase).toBeInstanceOf(CalendarUsecase);
        });

        it('[DT-2] PlaceUsecase - 登録後に解決可能', () => {
            registerApplication();
            const usecase = container.resolve('PlaceUsecase');
            expect(usecase).toBeInstanceOf(PlaceUsecase);
        });

        it('[DT-3] PlayerUsecase - 登録後に解決可能', () => {
            registerApplication();
            const usecase = container.resolve('PlayerUsecase');
            expect(usecase).toBeInstanceOf(PlayerUsecase);
        });

        it('[DT-4] RaceUsecase - 登録後に解決可能', () => {
            registerApplication();
            const usecase = container.resolve('RaceUsecase');
            expect(usecase).toBeInstanceOf(RaceUsecase);
        });
    });

    describe('API-8: 追加Domain（FeatureFlag・ReleaseNote・UiLayout・Auth・BatchLock・Favorite）', () => {
        it('FeatureFlagRepositoryが登録されること', () => {
            registerApplication();
            const repo = container.resolve<IFeatureFlagRepository>(
                DI_TOKENS.FeatureFlagRepository,
            );
            expect(repo).toBeInstanceOf(FeatureFlagRepository);
        });

        it('FeatureFlagUsecaseが登録されること', () => {
            registerApplication();
            const usecase = container.resolve(DI_TOKENS.FeatureFlagUsecase);
            expect(usecase).toBeInstanceOf(FeatureFlagUsecase);
        });

        it('AnnouncementUsecaseが登録されること', () => {
            registerApplication();
            const usecase = container.resolve(DI_TOKENS.AnnouncementUsecase);
            expect(usecase).toBeInstanceOf(AnnouncementUsecase);
        });

        it('ReleaseNoteRepositoryが登録されること', () => {
            registerApplication();
            const repo = container.resolve<IReleaseNoteRepository>(
                DI_TOKENS.ReleaseNoteRepository,
            );
            expect(repo).toBeInstanceOf(ReleaseNoteRepository);
        });

        it('ReleaseNoteUsecaseが登録されること', () => {
            registerApplication();
            const usecase = container.resolve(DI_TOKENS.ReleaseNoteUsecase);
            expect(usecase).toBeInstanceOf(ReleaseNoteUsecase);
        });

        it('UiLayoutUsecaseが登録されること', () => {
            registerApplication();
            const usecase = container.resolve(DI_TOKENS.UiLayoutUsecase);
            expect(usecase).toBeInstanceOf(UiLayoutUsecase);
        });

        it('BatchLockRepositoryが登録されること', () => {
            registerApplication();
            const repo = container.resolve<IBatchLockRepository>(
                DI_TOKENS.BatchLockRepository,
            );
            expect(repo).toBeInstanceOf(BatchLockRepository);
        });

        it('BatchLockUsecaseが登録されること', () => {
            registerApplication();
            const usecase = container.resolve(DI_TOKENS.BatchLockUsecase);
            expect(usecase).toBeInstanceOf(BatchLockUsecase);
        });

        it('AuthUsecaseが登録されること', () => {
            registerApplication();
            const usecase = container.resolve(DI_TOKENS.AuthUsecase);
            expect(usecase).toBeInstanceOf(AuthUsecase);
        });

        it('FavoriteRepositoryが登録されること', () => {
            registerApplication();
            const repo = container.resolve<IFavoriteRepository>(
                DI_TOKENS.FavoriteRepository,
            );
            expect(repo).toBeInstanceOf(FavoriteRepository);
        });

        it('FavoriteUsecaseが登録されること', () => {
            registerApplication();
            const usecase = container.resolve(DI_TOKENS.FavoriteUsecase);
            expect(usecase).toBeInstanceOf(FavoriteUsecase);
        });
    });
});
