/**
 * staleRacePlayerPruner ユニットテスト
 *
 * ## デシジョンテーブル: buildFreshRacePlayerIdsByRace
 *
 * | #    | succeededEntities                         | 期待結果                              |
 * |------|--------------------------------------------|------------------------------------------|
 * | B-01 | playerListありのエンティティ1件           | raceId→racePlayerId集合が1件のMap      |
 * | B-02 | playerListなしのエンティティのみ          | 空のMap（対象外）                       |
 *
 * ## デシジョンテーブル: pruneStaleRacePlayers
 *
 * | #    | DB状態                                    | succeededEntities            | 期待結果                        |
 * |------|--------------------------------------------|-------------------------------|-----------------------------------|
 * | P-01 | raceIdに車番1-3の3行、今回は1-2のみ       | playerList=[1,2]              | 車番3の行が削除される            |
 * | P-02 | raceIdに車番1の1行のみ                    | playerList=[1]（完全一致）    | 何も削除されない                 |
 * | P-03 | -                                          | 空配列                        | 何もクエリしない（早期return）   |
 * | P-04 | -                                          | playerList=undefinedのみ      | 何もクエリしない（対象レース0件）|
 * | P-05 | raceIdに車番1の1行                        | select がエラー               | 例外を投げずwarnログのみ         |
 * | P-06 | 101件のraceIdごとに車番1(fresh)・車番2(stale)| 各raceIdでplayerList=[車番1] | チャンク分割されても全raceId分stale削除される（Issue #2378） |
 */
import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import {
    buildFreshRacePlayerIdsByRace,
    pruneStaleRacePlayers,
} from '../../../../src/repository/utility/staleRacePlayerPruner';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

const RACE_ID = validateRaceId('keirin202608023601');

/** raceId・playerList を指定してKEIRINエンティティを組み立てる（P-06のraceId可変版） */
const buildKeirinEntityForRace = (
    raceId: string,
    playerList: RaceEntity['playerList'],
): RaceEntity => ({
    raceId: validateRaceId(raceId),
    placeId: validatePlaceId('keirin2026080236'),
    raceType: RaceType.KEIRIN,
    datetime: new Date('2026-08-02T00:00:00Z'),
    raceName: 'テストレース',
    raceNumber: 1,
    raceCourse: '小田原',
    locationCode: validateLocationCode('36'),
    raceGrade: 'GⅠ',
    raceStage: 'S級決勝',
    playerList,
});

const buildKeirinEntity = (playerList: RaceEntity['playerList']): RaceEntity =>
    buildKeirinEntityForRace(RACE_ID, playerList);

const seedRacePlayer = async (
    db: DrizzleD1Database<typeof schema>,
    carNumber: number,
): Promise<void> => {
    await db.insert(schema.racePlayer).values({
        racePlayerId: `${RACE_ID}${String(carNumber).padStart(2, '0')}`,
        raceId: RACE_ID,
        raceType: 'keirin',
        carNumber,
        frameNumber: carNumber,
        playerNo: `00000${carNumber}`,
        playerName: `選手${carNumber}`,
    });
};

/** raceId・車番を指定して race_player テーブルへ1行 INSERT する（P-06のraceId可変版） */
const seedRacePlayerForRace = async (
    db: DrizzleD1Database<typeof schema>,
    raceId: string,
    carNumber: number,
): Promise<void> => {
    await db.insert(schema.racePlayer).values({
        racePlayerId: `${raceId}${String(carNumber).padStart(2, '0')}`,
        raceId,
        raceType: 'keirin',
        carNumber,
        frameNumber: carNumber,
        playerNo: `00000${carNumber}`,
        playerName: `選手${carNumber}`,
    });
};

describe('buildFreshRacePlayerIdsByRace', () => {
    it('B-01: playerListありのエンティティからraceId→racePlayerId集合を組み立てる', () => {
        const entity = buildKeirinEntity([
            {
                carNumber: 1,
                frameNumber: 1,
                playerNo: '000001',
                playerName: '選手1',
            },
        ]);

        const result = buildFreshRacePlayerIdsByRace([entity]);

        expect(result.size).toBe(1);
        expect(result.get(RACE_ID)).toEqual(new Set([`${RACE_ID}01`]));
    });

    it('B-02: playerListなしのエンティティのみでは空のMapを返す', () => {
        const entity = buildKeirinEntity(undefined);

        const result = buildFreshRacePlayerIdsByRace([entity]);

        expect(result.size).toBe(0);
    });
});

describe('pruneStaleRacePlayers', () => {
    it('P-01: 今回の出走表に含まれなくなった車番の行が削除される', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );
        await seedRacePlayer(db, 1);
        await seedRacePlayer(db, 2);
        await seedRacePlayer(db, 3);
        const entity = buildKeirinEntity([
            {
                carNumber: 1,
                frameNumber: 1,
                playerNo: '000001',
                playerName: '選手1',
            },
            {
                carNumber: 2,
                frameNumber: 2,
                playerNo: '000002',
                playerName: '選手2',
            },
        ]);

        await pruneStaleRacePlayers(db, [entity]);

        const rows = await db.select().from(schema.racePlayer);
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map((r) => r.carNumber))).toEqual(new Set([1, 2]));
    });

    it('P-02: 出走表が既存行と完全一致するとき何も削除されない', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );
        await seedRacePlayer(db, 1);
        const entity = buildKeirinEntity([
            {
                carNumber: 1,
                frameNumber: 1,
                playerNo: '000001',
                playerName: '選手1',
            },
        ]);

        await pruneStaleRacePlayers(db, [entity]);

        const rows = await db.select().from(schema.racePlayer);
        expect(rows).toHaveLength(1);
    });

    it('P-03: succeededEntitiesが空のとき何もクエリしない', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );

        await pruneStaleRacePlayers(db, []);

        const rows = await db.select().from(schema.racePlayer);
        expect(rows).toHaveLength(0);
    });

    it('P-04: playerListを持つエンティティが1件も無いとき何もクエリしない', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );
        await seedRacePlayer(db, 1);
        const entity = buildKeirinEntity(undefined);

        await pruneStaleRacePlayers(db, [entity]);

        // playerListなしのエンティティは対象外のため、既存行は一切触られない
        const rows = await db.select().from(schema.racePlayer);
        expect(rows).toHaveLength(1);
    });

    it('P-05: DB(select)がエラーになっても例外を投げない', async () => {
        const rejectingChain: Record<string, unknown> = {
            from: () => rejectingChain,
            where: () => rejectingChain,
            then: (
                _resolve: (value: never) => void,
                reject: (reason: unknown) => void,
            ) => Promise.reject(new Error('DB unavailable')).catch(reject),
        };
        const failingGateway: IDrizzleGateway = {
            db: {
                select: () => rejectingChain,
            } as unknown as DrizzleD1Database<typeof schema>,
        };
        const entity = buildKeirinEntity([
            {
                carNumber: 1,
                frameNumber: 1,
                playerNo: '000001',
                playerName: '選手1',
            },
        ]);

        await expect(
            pruneStaleRacePlayers(failingGateway.db, [entity]),
        ).resolves.toBeUndefined();
    });

    // P-06: findStaleRacePlayerIds/削除 は D1 のバインド変数上限（100件）を
    // 超えないようraceId/racePlayerIdをチャンク分割する。101件のraceId
    // （チャンク境界をまたぐ件数）でも、全raceId分のstale race_playerが
    // 正しく削除されることを確認する（回帰テスト。Issue #2378）。
    it('P-06: 101件のraceIdに跨るstale race_playerがチャンク分割されても全件削除される', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );
        const raceCount = 101;
        const entities: RaceEntity[] = [];
        for (let index = 0; index < raceCount; index++) {
            // raceNumber(2桁)だけでは100件までしか一意にできないため、
            // 100件を超える分は開催日をずらして101件分のユニークなraceIdを作る
            const day = index < 100 ? '02' : '03';
            const locationCode = (index % 100).toString().padStart(2, '0');
            const raceId = `keirin202608${day}${locationCode}01`;
            await seedRacePlayerForRace(db, raceId, 1);
            await seedRacePlayerForRace(db, raceId, 2);
            entities.push(
                buildKeirinEntityForRace(raceId, [
                    {
                        carNumber: 1,
                        frameNumber: 1,
                        playerNo: '000001',
                        playerName: '選手1',
                    },
                ]),
            );
        }

        await pruneStaleRacePlayers(db, entities);

        const rows = await db.select().from(schema.racePlayer);
        expect(rows).toHaveLength(raceCount);
        expect(rows.every((row) => row.carNumber === 1)).toBe(true);
    });
});
