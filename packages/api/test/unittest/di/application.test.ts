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
 */
import 'reflect-metadata';

import { beforeEach, describe, expect, it } from 'bun:test';
import { container } from 'tsyringe';

import { registerApplication } from '../../../src/di/application';
import { registerInfrastructureForInMemory } from '../../../src/di/infrastructure';
import { CalendarRepository } from '../../../src/repository/implement/calendarRepository';
import { PlaceRepository } from '../../../src/repository/implement/placeRepository';
import { PlayerRepository } from '../../../src/repository/implement/playerRepository';
import { RaceRepository } from '../../../src/repository/implement/raceRepository';
import type { ICalendarRepository } from '../../../src/repository/interface/ICalendarRepository';
import type { IPlaceRepository } from '../../../src/repository/interface/IPlaceRepository';
import type { IPlayerRepository } from '../../../src/repository/interface/IPlayerRepository';
import type { IRaceRepository } from '../../../src/repository/interface/IRaceRepository';
import { CalendarUsecase } from '../../../src/usecase/implement/calendarUsecase';
import { PlaceUsecase } from '../../../src/usecase/implement/placeUsecase';
import { PlayerUsecase } from '../../../src/usecase/implement/playerUsecase';
import { RaceUsecase } from '../../../src/usecase/implement/raceUsecase';

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
});
