/**
 * ディシジョンテーブル
 * | 種別   | メソッド | 条件                      | expected           | 説明                     |
 * |-------|---------|--------------------------|-------------------|--------------------------|
 * | 正常系 | fetch   | フィルタ条件指定           | RaceEntity[]      | Service経由でデータ取得    |
 * | 正常系 | fetch   | 空の結果                  | []                | 該当データなし             |
 * | 正常系 | upsert  | 有効なエンティティ配列      | UpsertResult      | Service経由で登録/更新     |
 * | 異常系 | fetch   | repository.fetch が reject | reject            | エラー伝播契約             |
 * | 異常系 | upsert  | repository.upsert が reject | reject            | エラー伝播契約             |
 * | 正常系 | fetchCalendarEvent | 該当レースあり     | イベントプレビュー | convertRaceEntityToCalendarEventの結果を返す |
 * | 正常系 | fetchCalendarEvent | 該当レースなし     | null               | repositoryがnullを返す場合 |
 * | 異常系 | fetchCalendarEvent | repository.fetchByRaceIdがreject | reject | エラー伝播契約 |
 * | 正常系 | fetchWatchedRaceIds | raceId一覧指定    | Set<string>        | repositoryへ委譲した結果をそのまま返す |
 * | 異常系 | fetchWatchedRaceIds | repository.fetchWatchedRaceIdsがreject | reject | エラー伝播契約 |
 * | 正常系 | fetchRacePlayers | 該当raceId       | RacePlayerEntity[]  | repositoryへ委譲した結果をそのまま返す |
 * | 異常系 | fetchRacePlayers | repository.fetchRacePlayersがreject | reject | エラー伝播契約 |
 * | 正常系 | fetchRaceDetailUi | 該当レースあり・D1に保存済み構成なし | RaceDetailUi | 既定構成で解決したUIスキーマを返す |
 * | 正常系 | fetchRaceDetailUi | 該当レースあり・D1に保存済み構成あり | RaceDetailUi | 保存済み構成で解決したUIスキーマを返す |
 * | 正常系 | fetchRaceDetailUi | 該当レースなし   | null                | fetchRacePlayersは呼ばれない |
 * | 異常系 | fetchRaceDetailUi | repository.fetchByRaceIdがreject | reject | エラー伝播契約 |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { SearchRaceFilterParamsInput } from '@race-schedule/core';
import {
    RaceType,
    validateLocationCode,
    validateRaceId,
} from '@race-schedule/core';
import { container } from 'tsyringe';
import { RaceFactory } from '../../../../../../tests/shared/factories';
import { RaceUsecase } from '../../../../src/usecase/implement/raceUsecase';
import type { IRaceUsecase } from '../../../../src/usecase/interface/IRaceUsecase';
import { assertCalledWith, clearMocks } from '../../../common/clearMocks';
import { TestRepositorySetup } from '../../../common/TestRepositorySetup';
import { setupTestRepositoryMock } from '../../../testSetupHelper';

describe('RaceUsecase', () => {
    let usecase: IRaceUsecase;
    let repositorySetup: TestRepositorySetup;

    beforeEach(() => {
        repositorySetup = setupTestRepositoryMock();
        usecase = container.resolve(RaceUsecase);
    });

    afterEach(() => {
        clearMocks();
    });

    describe('fetch', () => {
        it('フィルタ条件を指定してレース一覧を取得できること', async () => {
            const mockRaces = [
                RaceFactory.create({
                    raceType: RaceType.JRA,
                    datetime: new Date('2025-01-05'),
                    locationCode: validateLocationCode('01'),
                    raceNumber: 1,
                    overrides: {
                        raceName: '東京競馬 第1レース',
                        raceGrade: '未勝利',
                    },
                }),
            ];
            repositorySetup.raceRepository.fetch.mockResolvedValue(mockRaces);

            const filter: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };
            const result = await usecase.fetch(filter);

            expect(result).toEqual(mockRaces);
            assertCalledWith(repositorySetup.raceRepository.fetch, filter);
        });

        it('該当データがない場合は空配列を返すこと', async () => {
            repositorySetup.raceRepository.fetch.mockResolvedValue([]);

            const filter: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.NAR],
            };
            const result = await usecase.fetch(filter);

            expect(result).toEqual([]);
        });

        // 異常系: repository.fetch が reject した場合、usecase.fetch も同じエラーで reject すること
        it('fetch_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('Database connection failed');
            repositorySetup.raceRepository.fetch.mockRejectedValue(dbError);

            const filter: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };

            await expect(usecase.fetch(filter)).rejects.toThrow(
                'Database connection failed',
            );
        });
    });

    describe('upsert', () => {
        it('エンティティ配列をupsertできること', async () => {
            const mockUpsertResult = {
                successCount: 1,
                failureCount: 0,
                failures: [],
            };
            repositorySetup.raceRepository.upsert.mockResolvedValue(
                mockUpsertResult,
            );

            const entities = [
                RaceFactory.create({
                    raceType: RaceType.JRA,
                    datetime: new Date('2025-01-05'),
                    locationCode: validateLocationCode('01'),
                    raceNumber: 1,
                    overrides: {
                        raceName: '東京競馬 第1レース',
                        raceGrade: '未勝利',
                    },
                }),
            ];
            const result = await usecase.upsert(entities);

            expect(result).toEqual(mockUpsertResult);
            assertCalledWith(repositorySetup.raceRepository.upsert, entities);
        });

        // 異常系: repository.upsert が reject した場合、usecase.upsert も同じエラーで reject すること
        it('upsert_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('DB constraint violation');
            repositorySetup.raceRepository.upsert.mockRejectedValue(dbError);

            const entities = [
                RaceFactory.create({
                    raceType: RaceType.JRA,
                    datetime: new Date('2025-01-05'),
                    locationCode: validateLocationCode('01'),
                    raceNumber: 1,
                    overrides: {
                        raceName: '東京競馬 第1レース',
                        raceGrade: '未勝利',
                    },
                }),
            ];

            await expect(usecase.upsert(entities)).rejects.toThrow(
                'DB constraint violation',
            );
        });
    });

    describe('fetchCalendarEvent', () => {
        it('該当レースがある場合、カレンダーイベントプレビューを返すこと', async () => {
            const raceEntity = RaceFactory.create({
                raceType: RaceType.JRA,
                datetime: new Date('2026-07-25T10:20:00+09:00'),
                locationCode: validateLocationCode('04'),
                raceNumber: 2,
                overrides: {
                    raceName: '2歳新馬',
                    raceGrade: '新馬',
                    placeHeldDays: { heldTimes: 2, heldDayTimes: 1 },
                },
            });
            repositorySetup.raceRepository.fetchByRaceId.mockResolvedValue(
                raceEntity,
            );

            const result = await usecase.fetchCalendarEvent(
                validateRaceId('jra202607250402'),
            );

            expect(result).not.toBeNull();
            expect(result?.summary).toBe('2歳新馬');
            expect(result?.description).toContain('発走: 10:20');
            expect(result?.description).toContain('レース情報(netkeiba)');
            expect(result?.description).toContain('レース動画(netkeiba)');
            expect(result?.description).toContain('レース映像（公式YouTube）');
            expect(result?.location).toBe('新潟競馬場');
            expect(result?.links).toEqual([
                {
                    label: 'レース情報(netkeiba)',
                    url: expect.any(String),
                },
                {
                    label: 'レース動画(netkeiba)',
                    url: expect.any(String),
                },
                {
                    label: 'レース映像（公式YouTube）',
                    url: expect.any(String),
                },
            ]);
            assertCalledWith(
                repositorySetup.raceRepository.fetchByRaceId,
                validateRaceId('jra202607250402'),
            );
        });

        it('該当レースがない場合、nullを返すこと', async () => {
            repositorySetup.raceRepository.fetchByRaceId.mockResolvedValue(
                null,
            );

            const result = await usecase.fetchCalendarEvent(
                validateRaceId('jra202607250403'),
            );

            expect(result).toBeNull();
        });

        // 異常系: repository.fetchByRaceId が reject した場合、usecase も同じエラーで reject すること
        it('fetchCalendarEvent_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('Database connection failed');
            repositorySetup.raceRepository.fetchByRaceId.mockRejectedValue(
                dbError,
            );

            await expect(
                usecase.fetchCalendarEvent(validateRaceId('jra202607250402')),
            ).rejects.toThrow('Database connection failed');
        });
    });

    describe('fetchWatchedRaceIds', () => {
        it('raceId一覧を渡すとrepositoryへ委譲した結果をそのまま返すこと', async () => {
            const watchedRaceIds = new Set(['keirin202608023601']);
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockResolvedValue(
                watchedRaceIds,
            );

            const result = await usecase.fetchWatchedRaceIds([
                'keirin202608023601',
            ]);

            expect(result).toBe(watchedRaceIds);
            assertCalledWith(
                repositorySetup.raceRepository.fetchWatchedRaceIds,
                ['keirin202608023601'],
            );
        });

        // 異常系: repository.fetchWatchedRaceIds が reject した場合、usecase も同じエラーで reject すること
        it('fetchWatchedRaceIds_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('Database connection failed');
            repositorySetup.raceRepository.fetchWatchedRaceIds.mockRejectedValue(
                dbError,
            );

            await expect(
                usecase.fetchWatchedRaceIds(['keirin202608023601']),
            ).rejects.toThrow('Database connection failed');
        });
    });

    describe('fetchRacePlayers', () => {
        it('raceIdを渡すとrepositoryへ委譲した結果をそのまま返すこと', async () => {
            const players = [
                {
                    carNumber: 1,
                    frameNumber: 1,
                    playerNo: '00001',
                    playerName: '山田太郎',
                },
            ];
            repositorySetup.raceRepository.fetchRacePlayers.mockResolvedValue(
                players,
            );

            const result = await usecase.fetchRacePlayers(
                validateRaceId('keirin202608023601'),
            );

            expect(result).toBe(players);
            assertCalledWith(
                repositorySetup.raceRepository.fetchRacePlayers,
                validateRaceId('keirin202608023601'),
            );
        });

        // 異常系: repository.fetchRacePlayers が reject した場合、usecase も同じエラーで reject すること
        it('fetchRacePlayers_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('Database connection failed');
            repositorySetup.raceRepository.fetchRacePlayers.mockRejectedValue(
                dbError,
            );

            await expect(
                usecase.fetchRacePlayers(validateRaceId('keirin202608023601')),
            ).rejects.toThrow('Database connection failed');
        });
    });

    describe('fetchRaceDetailUi', () => {
        it('該当レースがある場合、既定構成で解決したUIスキーマを返すこと', async () => {
            const raceEntity = RaceFactory.create({
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-08-02T14:33:00+09:00'),
                locationCode: validateLocationCode('36'),
                raceNumber: 10,
            });
            const players = [
                {
                    carNumber: 1,
                    frameNumber: 1,
                    playerNo: '012345',
                    playerName: '柴崎淳',
                },
            ];
            repositorySetup.raceRepository.fetchByRaceId.mockResolvedValue(
                raceEntity,
            );
            repositorySetup.raceRepository.fetchRacePlayers.mockResolvedValue(
                players,
            );

            const result = await usecase.fetchRaceDetailUi(
                validateRaceId('keirin202608023610'),
            );

            expect(result?.schemaVersion).toBe(1);
            const kvSection = result?.sections.find((s) => s.type === 'kv');
            expect(
                kvSection?.type === 'kv' &&
                    kvSection.rows.some(
                        (row) => row.label === '発走' && row.value === '14:33',
                    ),
            ).toBe(true);
            const playersSection = result?.sections.find(
                (s) => s.type === 'players',
            );
            expect(
                playersSection?.type === 'players' &&
                    playersSection.watchToggle,
            ).toBe(true);
            expect(
                playersSection?.type === 'players' && playersSection.rows,
            ).toEqual(players);
        });

        it('D1に保存済みの構成がある場合、その構成で解決したUIスキーマを返すこと', async () => {
            const raceEntity = RaceFactory.create({
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-08-02T14:33:00+09:00'),
                locationCode: validateLocationCode('36'),
                raceNumber: 10,
                overrides: { raceGrade: 'GⅢ' },
            });
            repositorySetup.raceRepository.fetchByRaceId.mockResolvedValue(
                raceEntity,
            );
            repositorySetup.raceRepository.fetchRacePlayers.mockResolvedValue(
                [],
            );
            repositorySetup.uiLayoutRepository.get.mockResolvedValue({
                sections: [
                    {
                        type: 'kv',
                        fields: [{ key: 'grade', label: '級・グレード' }],
                    },
                ],
            });

            const result = await usecase.fetchRaceDetailUi(
                validateRaceId('keirin202608023610'),
            );

            expect(result?.sections).toEqual([
                {
                    type: 'kv',
                    rows: [{ label: '級・グレード', value: 'GⅢ' }],
                },
            ]);
            expect(repositorySetup.uiLayoutRepository.get).toHaveBeenCalledWith(
                'race_detail.keirin',
            );
        });

        it('該当レースがない場合、nullを返しfetchRacePlayersを呼ばないこと', async () => {
            repositorySetup.raceRepository.fetchByRaceId.mockResolvedValue(
                null,
            );

            const result = await usecase.fetchRaceDetailUi(
                validateRaceId('keirin202608023610'),
            );

            expect(result).toBeNull();
            expect(
                repositorySetup.raceRepository.fetchRacePlayers,
            ).not.toHaveBeenCalled();
        });

        // 異常系: repository.fetchByRaceId が reject した場合、usecase も同じエラーで reject すること
        it('fetchRaceDetailUi_repositoryがrejectした場合_同じエラーでrejectすること', async () => {
            const dbError = new Error('Database connection failed');
            repositorySetup.raceRepository.fetchByRaceId.mockRejectedValue(
                dbError,
            );

            await expect(
                usecase.fetchRaceDetailUi(validateRaceId('keirin202608023610')),
            ).rejects.toThrow('Database connection failed');
        });
    });
});
