/**
 * uiLayoutUsecase.test.ts - UiLayoutUsecase ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: getConfig()
 * | ケース | uiLayoutRepository.get()の結果 | 期待値 |
 * |--------|----------------------------------|--------|
 * | G1 | 保存済み構成あり | その構成をそのまま返す |
 * | G2 | 保存済み構成なし（undefined） | コード内既定構成を返す |
 *
 * ### メソッド: saveConfig()
 * | ケース | 期待値 |
 * |--------|--------|
 * | S1 | `race_detail.<raceType>` キーでuiLayoutRepository.upsert()が呼ばれる |
 *
 * ### メソッド: previewConfig()
 * | ケース | raceRepository.fetchByRaceId()の結果 | 期待値 |
 * |--------|-----------------------------------------|--------|
 * | P1 | 該当レースあり | 指定した構成で解決したUIスキーマを返す |
 * | P2 | 該当レースなし | null（fetchRacePlayersは呼ばれない） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it, mock } from 'bun:test';
import type { RaceDetailUiConfig } from '@race-schedule/core';
import {
    RaceType,
    validateLocationCode,
    validateRaceId,
} from '@race-schedule/core';
import 'reflect-metadata';

import { RaceFactory } from '../../../../../../tests/shared/factories';
import type { IRaceRepository } from '../../../../src/repository/interface/IRaceRepository';
import type { IUiLayoutRepository } from '../../../../src/repository/interface/IUiLayoutRepository';
import { UiLayoutUsecase } from '../../../../src/usecase/implement/uiLayoutUsecase';

const createMockUiLayoutRepository = (
    overrides: Partial<IUiLayoutRepository> = {},
): IUiLayoutRepository => ({
    get: mock(() => Promise.resolve(undefined)),
    upsert: mock(() => Promise.resolve()),
    ...overrides,
});

const createMockRaceRepository = (
    overrides: Partial<IRaceRepository> = {},
): IRaceRepository => ({
    fetch: mock(() => Promise.resolve([])),
    upsert: mock(() =>
        Promise.resolve({ successCount: 0, failureCount: 0, failures: [] }),
    ),
    fetchByRaceId: mock(() => Promise.resolve(null)),
    fetchWatchedRaceIds: mock(() => Promise.resolve(new Set<string>())),
    fetchRacePlayers: mock(() => Promise.resolve([])),
    ...overrides,
});

const SAMPLE_CONFIG: RaceDetailUiConfig = {
    sections: [{ type: 'kv', fields: [{ key: 'grade' }] }],
};

describe('api/usecase/UiLayoutUsecase', () => {
    describe('getConfig', () => {
        it('G1: 保存済み構成がある場合はその構成をそのまま返す', async () => {
            const uiLayoutRepository = createMockUiLayoutRepository({
                get: mock(() => Promise.resolve(SAMPLE_CONFIG)),
            });
            const usecase = new UiLayoutUsecase(
                uiLayoutRepository,
                createMockRaceRepository(),
            );

            const result = await usecase.getConfig(RaceType.KEIRIN);

            expect(result).toBe(SAMPLE_CONFIG);
        });

        it('G2: 保存済み構成が無い場合はコード内既定構成を返す', async () => {
            const usecase = new UiLayoutUsecase(
                createMockUiLayoutRepository(),
                createMockRaceRepository(),
            );

            const result = await usecase.getConfig(RaceType.KEIRIN);

            const playersSection = result.sections.find(
                (s) => s.type === 'players',
            );
            expect(
                playersSection?.type === 'players' &&
                    playersSection.watchToggle,
            ).toBe(true);
        });
    });

    describe('saveConfig', () => {
        it('S1: race_detail.<raceType>キーでuiLayoutRepository.upsertが呼ばれること', async () => {
            const uiLayoutRepository = createMockUiLayoutRepository();
            const usecase = new UiLayoutUsecase(
                uiLayoutRepository,
                createMockRaceRepository(),
            );

            await usecase.saveConfig(RaceType.KEIRIN, SAMPLE_CONFIG);

            expect(uiLayoutRepository.upsert).toHaveBeenCalledWith(
                'race_detail.keirin',
                SAMPLE_CONFIG,
            );
        });
    });

    describe('previewConfig', () => {
        it('P1: 該当レースがある場合、指定した構成で解決したUIスキーマを返す', async () => {
            const raceEntity = RaceFactory.create({
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-08-02T14:33:00+09:00'),
                locationCode: validateLocationCode('36'),
                raceNumber: 10,
                overrides: { raceGrade: 'GⅢ' },
            });
            const raceRepository = createMockRaceRepository({
                fetchByRaceId: mock(() => Promise.resolve(raceEntity)),
            });
            const usecase = new UiLayoutUsecase(
                createMockUiLayoutRepository(),
                raceRepository,
            );

            const result = await usecase.previewConfig(
                SAMPLE_CONFIG,
                validateRaceId('keirin202608023610'),
            );

            expect(result?.sections).toEqual([
                { type: 'kv', rows: [{ label: 'グレード', value: 'GⅢ' }] },
            ]);
        });

        it('P2: 該当レースが無い場合、nullを返しfetchRacePlayersを呼ばないこと', async () => {
            const raceRepository = createMockRaceRepository();
            const usecase = new UiLayoutUsecase(
                createMockUiLayoutRepository(),
                raceRepository,
            );

            const result = await usecase.previewConfig(
                SAMPLE_CONFIG,
                validateRaceId('keirin202608023610'),
            );

            expect(result).toBeNull();
            expect(raceRepository.fetchRacePlayers).not.toHaveBeenCalled();
        });
    });
});
