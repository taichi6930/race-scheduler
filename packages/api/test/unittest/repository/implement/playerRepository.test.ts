/**
 * playerRepository.test.ts - PlayerRepository ユニットテスト
 *
 * Drizzle化に伴い、SQL文字列のモックではなく bun:sqlite ベースの
 * インメモリD1（createInMemoryD1Database）に対して実際にクエリを実行する形へ変更した
 * （drizzle のクエリビルダはコンパイル時に組み立てられるため、
 * SQL文字列呼び出し回数のモック検証では実質的な検証にならないため）。
 * DB障害系（U5/U6）のみ、insert が reject するフェイクの IDrizzleGateway を使う。
 *
 * ## デシジョンテーブル
 *
 * priorityはplayer_watchへ分離した（keirin-player-data-design.md §4.4）。
 * fetch()はplayerをplayer_watchへLEFT JOINして合成し、upsert()はplayerと
 * player_watchの両方へ書き込む。
 *
 * ### メソッド: fetch()
 * | ケース | 入力 | DB状態 | 期待値 |
 * |--------|------|--------|--------|
 * | F1 | raceTypeList=[keirin] | 有効な選手行1件 + player_watch行(priority=7) | priorityがplayer_watchの値(7)で返る |
 * | F1b | raceTypeList=[keirin] | 有効な選手行1件（player_watch行なし） | priorityが0（COALESCEの既定値）で返る |
 * | F2 | raceTypeList=[keirin] | 無効な行（playerNameが空文字） | Error をスロー |
 * | F3 | raceTypeList=[jra] | 空 | [] |
 * | F4 | raceTypeList=[keirin], playerName="田中" | "山田太郎"・"田中一郎"の2件 | "田中一郎"のみ返る（部分一致） |
 * | F5 | raceTypeList=[keirin], playerName未指定 | "山田太郎"・"田中一郎"の2件 | 絞り込みなしで2件とも返る |
 * | F6 | raceTypeList=[keirin] | player_keirin行あり | term/branchがplayer_keirinの値で返る |
 * | F7 | raceTypeList=[keirin] | player_keirin行なし | term/branchがundefinedで返る |
 * | F8 | raceTypeList=[autorace] | player_autorace行あり | branchがplayer_autoraceの値で返る（termはundefined） |
 *
 * ### メソッド: upsert()
 * | ケース | エンティティリスト | 期待値 |
 * |--------|-------------------|--------|
 * | U1 | 単一エンティティ | player 1行・player_watch 1行(priority反映)・successCount=1 |
 * | U2 | 複数エンティティ（チャンク未満） | 全件player/player_watch両方に永続化・successCount=2 |
 * | U3 | 空リスト | DBへ何も書き込まない・空のUpsertResultを返す |
 * | U4 | 34件（チャンク境界=33超え） | 全34件がplayer/player_watch両方に永続化される・successCount=34 |
 * | U5 | DB書き込みが Error で失敗 | failureCount++・failures[]にreasonが積まれる（例外は伝播しない） |
 * | U6 | DB書き込みが非 Error(文字列) で失敗 | failureCount++・failures[]にreasonが積まれる（例外は伝播しない） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    RaceType,
    type SearchPlayerFilterParamsInput,
} from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { PlayerRepository } from '../../../../src/repository/implement/playerRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

/** insert チェーンが必ず reject する DrizzleD1Database の最小フェイク（U5/U6用） */
const buildFailingDb = (reason: unknown): DrizzleD1Database<typeof schema> => {
    const failing = {
        insert: () => ({
            values: () => ({
                onConflictDoUpdate: () => Promise.reject(reason),
            }),
        }),
    };
    return failing as unknown as DrizzleD1Database<typeof schema>;
};

describe('PlayerRepository', () => {
    let repository: PlayerRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new PlayerRepository(drizzleGateway);
    });

    afterEach(() => {
        // クリーンアップ不要（各テストで新しいインメモリDBを作成するため）
    });

    describe('fetch', () => {
        // F1: 有効な選手行 + player_watch行 → priorityはplayer_watchの値で返る
        it('F1: player_watchが存在する場合そのpriorityを返す', async () => {
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
            };
            // player.priorityはレガシー列（もはや読まれない）で、あえて別値(5)を
            // 入れてplayer_watch側(7)が優先されることを検証する。
            await db.insert(schema.player).values({
                raceType: 'keirin',
                playerNo: '123',
                playerName: '選手名前',
                priority: 5,
            });
            await db.insert(schema.playerWatch).values({
                raceType: 'keirin',
                playerNo: '123',
                priority: 7,
            });

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].raceType).toBe('keirin');
            expect(result[0].playerNo).toBe('123');
            expect(result[0].playerName).toBe('選手名前');
            expect(result[0].priority).toBe(7);
        });

        // F1b: player_watch行が無い選手 → priorityは0（COALESCEの既定値）
        it('F1b: player_watch行が無い場合priorityは0を返す', async () => {
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
            };
            await db.insert(schema.player).values({
                raceType: 'keirin',
                playerNo: '123',
                playerName: '選手名前',
                priority: 5,
            });

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].priority).toBe(0);
        });

        // F2: 無効な行（playerNameが空文字）→ Error をスロー
        it('F2: player行が不正なときErrorをスローする', async () => {
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
            };
            // playerName を空文字にすることで playerRowSchema.safeParse を失敗させる
            // （NOT NULL 制約はDB上通るが、Mapper側の min(1) 検証で弾かれる）
            await db.insert(schema.player).values({
                raceType: 'keirin',
                playerNo: '123',
                playerName: '',
                priority: 5,
            });

            await expect(repository.fetch(params)).rejects.toThrow();
        });

        // F3: 空の結果 → 空配列を返す
        it('F3: DBが空のとき空配列を返す', async () => {
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.JRA],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(0);
            expect(Array.isArray(result)).toBe(true);
        });

        // F4: playerNameで部分一致検索 → 一致する選手のみ返る
        it('F4: playerNameを指定すると部分一致する選手のみ返す', async () => {
            await db.insert(schema.player).values([
                {
                    raceType: 'keirin',
                    playerNo: '111',
                    playerName: '山田太郎',
                    priority: 0,
                },
                {
                    raceType: 'keirin',
                    playerNo: '222',
                    playerName: '田中一郎',
                    priority: 0,
                },
            ]);
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
                playerName: '田中',
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].playerName).toBe('田中一郎');
        });

        // F5: playerName未指定 → 絞り込み無しで全件返る
        it('F5: playerName未指定のとき絞り込みなしで全件返す', async () => {
            await db.insert(schema.player).values([
                {
                    raceType: 'keirin',
                    playerNo: '111',
                    playerName: '山田太郎',
                    priority: 0,
                },
                {
                    raceType: 'keirin',
                    playerNo: '222',
                    playerName: '田中一郎',
                    priority: 0,
                },
            ]);
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(2);
        });

        // F6: player_keirin行あり → term/branchがplayer_keirinの値で返る
        it('F6: player_keirinが存在する場合そのterm/branchを返す', async () => {
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
            };
            await db.insert(schema.player).values({
                raceType: 'keirin',
                playerNo: '123',
                playerName: '選手名前',
                priority: 0,
            });
            await db.insert(schema.playerKeirin).values({
                playerNo: '123',
                term: 100,
                branch: '京都',
            });

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].term).toBe(100);
            expect(result[0].branch).toBe('京都');
        });

        // F7: player_keirin行なし → term/branchがundefinedで返る
        it('F7: player_keirinが存在しない場合term/branchはundefinedを返す', async () => {
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.KEIRIN],
            };
            await db.insert(schema.player).values({
                raceType: 'keirin',
                playerNo: '123',
                playerName: '選手名前',
                priority: 0,
            });

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].term).toBeUndefined();
            expect(result[0].branch).toBeUndefined();
        });

        // F8: player_autorace行あり → branchがplayer_autoraceの値で返る（termは無い）
        it('F8: player_autoraceが存在する場合そのbranchを返す（termはundefined）', async () => {
            const params: SearchPlayerFilterParamsInput = {
                raceTypeList: [RaceType.AUTORACE],
            };
            await db.insert(schema.player).values({
                raceType: 'autorace',
                playerNo: '2809',
                playerName: '柴田 紘志',
                priority: 0,
            });
            await db.insert(schema.playerAutorace).values({
                playerNo: '2809',
                branch: '浜松',
            });

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].branch).toBe('浜松');
            expect(result[0].term).toBeUndefined();
        });
    });

    describe('upsert', () => {
        // U1: 単一エンティティ → player/player_watch両方に永続化される
        it('U1: 単一エンティティがplayer/player_watch両方に永続化されsuccessCountを返す', async () => {
            const entities = [
                {
                    raceType: RaceType.KEIRIN,
                    playerNo: '123',
                    playerName: '選手名前',
                    priority: 5,
                },
            ];

            const result = await repository.upsert(entities);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(0);
            const playerRows = await db.select().from(schema.player);
            expect(playerRows).toHaveLength(1);
            expect(playerRows[0].playerName).toBe('選手名前');
            const watchRows = await db.select().from(schema.playerWatch);
            expect(watchRows).toHaveLength(1);
            expect(watchRows[0].priority).toBe(5);
        });

        // U2: 複数エンティティ
        it('U2: 複数エンティティが全件DBに永続化されsuccessCountを返す', async () => {
            const entities = [
                {
                    raceType: RaceType.KEIRIN,
                    playerNo: '123',
                    playerName: '選手1',
                    priority: 5,
                },
                {
                    raceType: RaceType.KEIRIN,
                    playerNo: '456',
                    playerName: '選手2',
                    priority: 3,
                },
            ];

            const result = await repository.upsert(entities);

            expect(result.successCount).toBe(2);
            const playerRows = await db.select().from(schema.player);
            expect(playerRows).toHaveLength(2);
            const watchRows = await db.select().from(schema.playerWatch);
            expect(watchRows).toHaveLength(2);
        });

        // U3: 空リスト → DBへ何も書き込まない
        it('U3: 空エンティティリストではDBへ何も書き込まず空のUpsertResultを返す', async () => {
            const result = await repository.upsert([]);

            expect(result).toEqual({
                successCount: 0,
                failureCount: 0,
                failures: [],
            });
            const rows = await db.select().from(schema.player);
            expect(rows).toHaveLength(0);
        });

        // U4: 34件（チャンクサイズ33超え）→ 2チャンク(33+1)に分割されても
        //     全34件がDBへ永続化されること（チャンク分割で欠落しない）
        it('U4: チャンク境界を超える34件を分割しても全件をDBへ永続化する', async () => {
            const playerNos = Array.from({ length: 34 }, (_, index) =>
                String(index + 1).padStart(5, '0'),
            );
            const entities = playerNos.map((playerNo, index) => ({
                raceType: RaceType.KEIRIN,
                playerNo,
                playerName: `選手${index + 1}`,
                priority: index,
            }));

            const result = await repository.upsert(entities);

            expect(result.successCount).toBe(34);
            const playerRows = await db.select().from(schema.player);
            expect(new Set(playerRows.map((r) => r.playerNo))).toEqual(
                new Set(playerNos),
            );
            const watchRows = await db.select().from(schema.playerWatch);
            expect(new Set(watchRows.map((r) => r.playerNo))).toEqual(
                new Set(playerNos),
            );
        });

        // U5: DB書き込みが Error で失敗 → failureCount/failures に集約し、例外は伝播しない
        it('U5: DB書き込みがErrorで失敗したときfailureCountとfailuresに積むこと', async () => {
            const failingGateway: IDrizzleGateway = {
                db: buildFailingDb(new Error('DB error')),
            };
            repository = new PlayerRepository(failingGateway);
            const entities = [
                {
                    raceType: RaceType.KEIRIN,
                    playerNo: '00001',
                    playerName: '選手1',
                    priority: 0,
                },
            ];

            const result = await repository.upsert(entities);

            expect(result.successCount).toBe(0);
            expect(result.failureCount).toBe(1);
            expect(result.failures[0]).toEqual({
                db: 'player',
                id: '00001',
                reason: expect.stringContaining('DB error'),
            });
        });

        // U6: 非 Error（文字列）で失敗 → failureCount/failures に集約し、例外は伝播しない
        it('U6: 非Errorで失敗したときfailureCountとfailuresに積むこと', async () => {
            const failingGateway: IDrizzleGateway = {
                db: buildFailingDb('string failure'),
            };
            repository = new PlayerRepository(failingGateway);
            const entities = [
                {
                    raceType: RaceType.KEIRIN,
                    playerNo: '00001',
                    playerName: '選手1',
                    priority: 0,
                },
            ];

            const result = await repository.upsert(entities);

            expect(result.failureCount).toBe(1);
            expect(result.failures[0].reason).toContain('Unknown error');
        });
    });
});
