/**
 * raceDetailUi.get.controller.usecase.repository.component.test.ts
 *
 * GET /ui/race-detail エンドポイントのコンポーネントテスト（race-detail-sdui-design.md）。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemory D1（Drizzle）
 *
 * controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る。
 * 目的は「配線が正しく繋がっていること」の代表1本の確認であり、フィールド解決の
 * 網羅（core側のresolveRaceDetailUi/fieldCatalogのUTで担保）はここでは検証しない。
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
import {
    type RaceDetailUi,
    RaceType,
    toJstISOString,
    validateLocationCode,
} from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import { RaceFactory } from '../../../../../tests/shared/factories';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

/** インメモリD1（Drizzle経由）へ 1 件のKEIRINレースを投入する（raceStageも投入） */
const insertKeirinRace = async (
    db: DrizzleD1Database<typeof schema>,
    race: ReturnType<typeof RaceFactory.create>,
): Promise<void> => {
    await db.insert(schema.race).values({
        raceId: race.raceId,
        placeId: race.placeId,
        raceType: race.raceType,
        raceName: race.raceName,
        dateTime: toJstISOString(race.datetime),
        locationCode: race.locationCode,
        grade: race.raceGrade,
        raceNumber: race.raceNumber,
    });

    if (race.raceStage) {
        await db.insert(schema.raceStage).values({
            raceId: race.raceId,
            raceStage: race.raceStage,
        });
    }
};

describe('コンポーネントテスト: GET /ui/race-detail Router → Controller → Usecase → Repository → InMemory D1', () => {
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

    it('該当レースが存在する場合、kv/links/playersセクションを含むUIスキーマを返すこと', async () => {
        const race = RaceFactory.create({
            raceType: RaceType.KEIRIN,
            datetime: new Date('2026-08-02T14:33:00+09:00'),
            locationCode: validateLocationCode('36'),
            raceNumber: 10,
        });
        await insertKeirinRace(db, race);

        const response = await requestApi(
            d1,
            `/ui/race-detail?raceId=${race.raceId}`,
        );
        const body = (await response.json()) as RaceDetailUi;

        expect(response.status).toBe(200);
        expect(body.schemaVersion).toBe(1);

        const kvSection = body.sections.find((s) => s.type === 'kv');
        expect(
            kvSection?.type === 'kv' &&
                kvSection.rows.some(
                    (row) => row.label === '発走' && row.value === '14:33',
                ),
        ).toBe(true);

        const linksSection = body.sections.find((s) => s.type === 'links');
        expect(linksSection?.type === 'links').toBe(true);

        const playersSection = body.sections.find((s) => s.type === 'players');
        expect(
            playersSection?.type === 'players' && playersSection.watchToggle,
        ).toBe(true);
        expect(
            playersSection?.type === 'players' && playersSection.rows,
        ).toEqual([]);
    });

    it('該当レースが存在しない場合、404を返すこと', async () => {
        const response = await requestApi(
            d1,
            '/ui/race-detail?raceId=keirin202608023699',
        );

        expect(response.status).toBe(404);
    });
});
