/**
 * raceFactory.inMemoryDB.component.test.ts
 *
 * コンポーネントテストのサンプル
 *
 * 検証内容:
 *  - tests/shared/factories/RaceFactory で生成した RaceEntity を、
 *    bun:sqlite ベースのインメモリD1（Drizzle経由）に対して INSERT し、SELECT で取得できる
 *  - 共有 Factory + 共有 env helper + パッケージ内 Drizzle スキーマを「結合」して動かす
 *
 * 詳しい layered test 戦略は .claude/docs/testing-conventions.md を参照。
 */

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'bun:test';
import { toJstISOString } from '@race-schedule/core';
import { eq } from 'drizzle-orm';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import { RaceFactory } from '../../../../../tests/shared/factories';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';

describe('コンポーネントテスト: RaceFactory + Drizzle(InMemory D1)', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;

    beforeAll(() => {
        restoreEnv = useInMemoryDB();
    });

    afterAll(() => {
        restoreEnv();
    });

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
    });

    it('Factoryで生成したJRAレース_INSERT後にSELECTで取得できる', async () => {
        const race = RaceFactory.create();

        await db
            .insert(schema.race)
            .values({
                raceId: race.raceId,
                placeId: race.placeId,
                raceType: race.raceType,
                raceName: race.raceName,
                dateTime: toJstISOString(race.datetime),
                locationCode: race.locationCode,
                grade: race.raceGrade,
                raceNumber: race.raceNumber,
            })
            .onConflictDoUpdate({
                target: schema.race.raceId,
                set: { raceName: race.raceName },
            });

        const result = await db
            .select()
            .from(schema.race)
            .where(eq(schema.race.raceId, race.raceId));

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            raceId: race.raceId,
            raceType: race.raceType,
            raceName: race.raceName,
            locationCode: race.locationCode,
            grade: race.raceGrade,
            raceNumber: race.raceNumber,
        });
    });

    it('createMany_3件_全てINSERT後にSELECTで件数一致', async () => {
        const races = RaceFactory.createMany(3);

        for (const race of races) {
            await db
                .insert(schema.race)
                .values({
                    raceId: race.raceId,
                    placeId: race.placeId,
                    raceType: race.raceType,
                    raceName: race.raceName,
                    dateTime: toJstISOString(race.datetime),
                    locationCode: race.locationCode,
                    grade: race.raceGrade,
                    raceNumber: race.raceNumber,
                })
                .onConflictDoUpdate({
                    target: schema.race.raceId,
                    set: { raceName: race.raceName },
                });
        }

        const result = await db
            .select()
            .from(schema.race)
            .where(eq(schema.race.raceType, 'jra'));

        expect(result).toHaveLength(3);
    });
});
