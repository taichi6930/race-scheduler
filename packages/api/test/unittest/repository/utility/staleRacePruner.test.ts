/**
 * staleRacePruner ユニットテスト
 *
 * ## デシジョンテーブル: pruneStaleRaces
 *
 * | #    | DB状態                                      | succeededEntities         | 期待結果                                  |
 * |------|-----------------------------------------------|-----------------------------|----------------------------------------------|
 * | S-01 | 同一placeIdにfresh/stale各1行ずつ            | freshのみ                   | staleのみ削除される                        |
 * | S-02 | 101件のplaceIdごとにfresh/stale各1行ずつ     | 101件（各placeIdのfreshのみ）| チャンク分割されても全placeId分stale削除される（Issue #2378） |
 */
import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import { eq } from 'drizzle-orm';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';

import * as schema from '../../../../src/db/schema';
import { pruneStaleRaces } from '../../../../src/repository/utility/staleRacePruner';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

/** placeId/raceId 用の連番から、jraのplaceId（jra + yyyymmdd + locationCode）を組み立てる */
const buildPlaceIdString = (index: number): string => {
    const day = index < 100 ? '01' : '02';
    const locationCode = (index % 100).toString().padStart(2, '0');
    return `jra202501${day}${locationCode}`;
};

const buildRaceEntity = (raceIdSuffix: string, placeIdString: string) => {
    const placeId = validatePlaceId(placeIdString);
    return {
        raceId: validateRaceId(`${placeIdString}${raceIdSuffix}`),
        placeId,
        raceType: RaceType.JRA,
        datetime: new Date('2025-01-01T00:00:00Z'),
        raceName: 'テストレース',
        raceNumber: raceIdSuffix === '01' ? 1 : 2,
        raceCourse: '東京',
        locationCode: validateLocationCode(placeIdString.slice(-2)),
        raceGrade: 'GⅠ',
    } as RaceEntity;
};

/** race テーブルへ直接1行 INSERT する（pruneStaleRaces は race/race_condition/race_stage のみを見るため最小限で十分） */
const seedRaceRow = async (
    db: DrizzleD1Database<typeof schema>,
    entity: RaceEntity,
): Promise<void> => {
    // dateTimeはplaceIdが表す開催日（yyyymmdd部分）の範囲内である必要がある
    // （buildFetchedDateTimeRangeByPlaceのCONC-04判定に合わせる）
    const yyyyMMdd = entity.placeId.slice(3, 11);
    const day = yyyyMMdd.slice(6, 8);
    const month = yyyyMMdd.slice(4, 6);
    const year = yyyyMMdd.slice(0, 4);
    await db.insert(schema.race).values({
        raceId: entity.raceId,
        placeId: entity.placeId,
        raceType: entity.raceType,
        raceName: entity.raceName,
        dateTime: `${year}-${month}-${day}T10:00:00+09:00`,
        locationCode: entity.locationCode,
        grade: entity.raceGrade,
        raceNumber: entity.raceNumber,
    });
};

describe('pruneStaleRaces', () => {
    it('S-01: 今回取得結果に無いraceIdが同一placeId内で削除される', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );
        const placeIdString = buildPlaceIdString(0);
        const freshEntity = buildRaceEntity('01', placeIdString);
        const staleEntity = buildRaceEntity('02', placeIdString);
        await seedRaceRow(db, freshEntity);
        await seedRaceRow(db, staleEntity);

        await pruneStaleRaces(db, [freshEntity], new Set());

        const rows = await db
            .select()
            .from(schema.race)
            .where(eq(schema.race.placeId, placeIdString));
        expect(rows).toHaveLength(1);
        expect(rows[0].raceId).toBe(freshEntity.raceId);
    });

    // S-02: findStaleRaceIds/deleteStaleRaceRows は D1 のバインド変数上限（100件）を
    // 超えないようplaceId/raceIdをチャンク分割する。101件のplaceId（チャンク境界を
    // またぐ件数）でも、全placeId分のstale raceが正しく削除されることを確認する
    // （回帰テスト。Issue #2378）。
    it('S-02: 101件のplaceIdに跨るstale raceがチャンク分割されても全件削除される', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );
        const placeCount = 101;
        const freshEntities: RaceEntity[] = [];
        for (let index = 0; index < placeCount; index++) {
            const placeIdString = buildPlaceIdString(index);
            const freshEntity = buildRaceEntity('01', placeIdString);
            const staleEntity = buildRaceEntity('02', placeIdString);
            await seedRaceRow(db, freshEntity);
            await seedRaceRow(db, staleEntity);
            freshEntities.push(freshEntity);
        }

        await pruneStaleRaces(db, freshEntities, new Set());

        const rows = await db.select().from(schema.race);
        expect(rows).toHaveLength(placeCount);
        expect(rows.every((row) => row.raceId.endsWith('01'))).toBe(true);
    });
});
