/**
 * player.get.controller.usecase.repository.component.test.ts
 *
 * PLAYER-1 ~ PLAYER-4: GET /player エンドポイントのコンポーネントテスト
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemoryDB
 *
 * controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る
 * （`requestApi` ヘルパー経由。詳細・設計方針は place.get...component.test.ts のコメントおよび
 * .claude/docs/testing-conventions.md §コンポーネントテスト を参照）。
 *
 * ## シナリオテーブル（Player GET Router → Controller → Usecase → Repository → InMemoryDB）
 *
 * | #        | 投入データ                    | リクエスト条件           | 期待                          |
 * |----------|-------------------------------|--------------------------|-------------------------------|
 * | PLAYER-1 | JRA 1件                       | raceTypeList=jra         | count=1, playerNo 一致        |
 * | PLAYER-2 | JRA 3件（player_no 逆順投入） | raceTypeList=jra         | 3件・player_no 昇順           |
 * | PLAYER-3 | JRA 2件 + KEIRIN 1件          | raceTypeList=jra         | JRA 2件のみ                   |
 * | PLAYER-4 | JRA 1件                       | raceTypeList=nar         | count=0（該当なし）           |
 */

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { RaceType } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import { PlayerFactory } from '../../../../../tests/shared/factories';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

/** インメモリD1（Drizzle経由）へ 1 件の PlayerEntity を投入する */
const insertPlayer = async (
    db: DrizzleD1Database<typeof schema>,
    player: ReturnType<typeof PlayerFactory.create>,
): Promise<void> => {
    await db.insert(schema.player).values({
        raceType: player.raceType,
        playerNo: player.playerNo,
        playerName: player.playerName,
        priority: player.priority,
    });
};

interface PlayerGetResponseBody {
    count: number;
    players: { raceType: string; playerNo: string; priority: number }[];
}

describe('コンポーネントテスト: Player GET Router → Controller → Usecase → Repository → InMemoryDB', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;

    beforeAll(() => {
        restoreEnv = useInMemoryDB();
    });

    afterAll(() => {
        restoreEnv();
    });

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('PLAYER-1: 基本取得_JRA1件を投入_1件取得できること', async () => {
        // Arrange
        const player = PlayerFactory.create({
            raceType: RaceType.JRA,
            playerNo: '00007',
        });
        await insertPlayer(db, player);

        // Act
        const params = new URLSearchParams({ raceTypeList: 'jra' });
        const response = await requestApi(d1, `/player?${params.toString()}`);
        const body = (await response.json()) as PlayerGetResponseBody;

        // Assert
        expect(response.status).toBe(200);
        expect(body.count).toBe(1);
        expect(body.players[0].playerNo).toBe('00007');
    });

    it('PLAYER-2: 複数取得_逆順で投入_player_no昇順で取得できること', async () => {
        // Arrange
        // 逆順（03, 02, 01）で投入し、ORDER BY player_no ASC を検証
        for (const no of ['00003', '00002', '00001']) {
            await insertPlayer(
                db,
                PlayerFactory.create({ raceType: RaceType.JRA, playerNo: no }),
            );
        }

        // Act
        const params = new URLSearchParams({ raceTypeList: 'jra' });
        const response = await requestApi(d1, `/player?${params.toString()}`);
        const body = (await response.json()) as PlayerGetResponseBody;

        // Assert
        expect(body.count).toBe(3);
        expect(body.players.map((p) => p.playerNo)).toEqual([
            '00001',
            '00002',
            '00003',
        ]);
    });

    it('PLAYER-3: 種別フィルタ_JRA2件+KEIRIN1件_JRAのみ取得すること', async () => {
        // Arrange
        await insertPlayer(
            db,
            PlayerFactory.create({ raceType: RaceType.JRA, playerNo: '00001' }),
        );
        await insertPlayer(
            db,
            PlayerFactory.create({ raceType: RaceType.JRA, playerNo: '00002' }),
        );
        await insertPlayer(
            db,
            PlayerFactory.create({
                raceType: RaceType.KEIRIN,
                playerNo: '00003',
            }),
        );

        // Act
        const params = new URLSearchParams({ raceTypeList: 'jra' });
        const response = await requestApi(d1, `/player?${params.toString()}`);
        const body = (await response.json()) as PlayerGetResponseBody;

        // Assert
        expect(body.count).toBe(2);
        expect(body.players.every((p) => p.raceType === 'jra')).toBe(true);
    });

    it('PLAYER-4: 空結果_該当種別なし_count0を返すこと', async () => {
        // Arrange
        await insertPlayer(
            db,
            PlayerFactory.create({ raceType: RaceType.JRA, playerNo: '00001' }),
        );

        // Act
        const params = new URLSearchParams({ raceTypeList: 'nar' });
        const response = await requestApi(d1, `/player?${params.toString()}`);
        const body = (await response.json()) as PlayerGetResponseBody;

        // Assert
        expect(response.status).toBe(200);
        expect(body.count).toBe(0);
        expect(body.players).toHaveLength(0);
    });
});
