/**
 * placeRepository.test.ts - Place Repository ユニットテスト
 *
 * Drizzle化に伴い、SQL文字列のモックではなく bun:sqlite ベースの
 * インメモリD1（createInMemoryD1Database）に対して実際にクエリを実行する形へ変更した
 * （drizzle のクエリビルダはコンパイル時に組み立てられるため、
 * SQL文字列呼び出し検証では実質的な検証にならないため）。
 * DB障害系（F6/U7）のみ、select/insert が reject するフェイクの IDrizzleGateway を使う。
 *
 * PlaceMapper.toEntity() 自体のデシジョンテーブル・テストは placeMapper.test.ts に分離済み。
 * 本ファイルは repository 層（フィルタ組み立て・fetch/upsertのオーケストレーション）に集中する。
 *
 * ### Method: fetch()
 * | Case | Params | DB状態 | Expected |
 * |------|--------|--------|----------|
 * | F1 | Date range only | 1 place (location_code='01', JRA) | Array[PlaceEntity] with 1 item, raceCourse='札幌' |
 * | F2 | finishDate当日のdatetime（日中）を含む4日分 | finishDateはJST深夜0時（日末補正なし） | finishDate当日は範囲外（between上限が当日0時のため） |
 * | F3 | Date range + locationList | 2 places | Filtered array with matching locations |
 * | F4 | Date range + gradeList | 2 places (grade有無混在) | Filtered array with matching grade |
 * | F5 | Params that match nothing | 空 | Empty array |
 * | F6 | DB(select)がエラー | Error | Propagates error |
 * | F7 | Row with mapping error + valid row | Invalid row + valid row | Invalid row skipped (logged), valid row returned |
 * | F8 | 全件対象 | 10,001件のplace行 | PERF-040: 10,000件に切り詰められる |
 *
 * ### Method: upsert()
 * | Case | EntityList | Expected |
 * |------|-----------|----------|
 * | U1 | Single entity with all fields | place/place_held_dayに永続化・place_gradeは無し |
 * | U2 | Multiple entities | successCount=N |
 * | U3 | Entity with placeHeldDays | place_held_dayに実値で永続化 |
 * | U4 | Mechanical type with placeGrade | place_gradeに実値で永続化・DELETE無し |
 * | U5 | Non-mechanical type（既存place_gradeあり） | place_gradeが削除される |
 * | U7 | DB(insert)がエラー | failureCount++, failures[] populated |
 * | U8 | Empty list | Returns empty result |
 * | U9 | isRaceListAvailable true/false/undefined | true/false/undefinedがDBに1/0/nullで永続化 |
 *
 * ## Coverage Target: 100% Line & Branch Coverage
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
    generatePlaceEntity,
    type PlaceEntity,
    RaceType,
    type SearchPlaceFilterParamsInput,
    validateLocationCode,
    validatePlaceId,
} from '@race-schedule/core';
import { eq } from 'drizzle-orm';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { PlaceRepository } from '../../../../src/repository/implement/placeRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

/** select チェーンが必ず reject する DrizzleD1Database の最小フェイク（F6用） */
const buildFailingSelectDb = (
    reason: unknown,
): DrizzleD1Database<typeof schema> => {
    const failing = {
        select: () => ({
            from: () => ({
                leftJoin: () => ({
                    leftJoin: () => ({
                        where: () => ({
                            // PERF-040: fetch() が防御的上限として `.limit()` を呼ぶため、
                            // フェイクチェーンにも追加する。
                            limit: () => Promise.reject(reason),
                        }),
                    }),
                }),
            }),
        }),
    };
    return failing as unknown as DrizzleD1Database<typeof schema>;
};

/**
 * insert チェーンは実行しない無害な値を返し、batch() が必ず reject する
 * DrizzleD1Database の最小フェイク（U7用）。
 * @remarks
 * CONC-06でplace/place_held_day/place_gradeへのINSERTが `db.batch()` 1回に
 * まとめられたため、`insert().values().onConflictDoUpdate()` 自体は
 * クエリを組み立てるだけで実行しない（真の Drizzle と同じ「未実行のクエリ
 * ビルダーを返す」振る舞いに合わせる。ここで直接 reject された Promise を
 * 返すと、batch() に渡される前に unhandled rejection として検出されてしまう）。
 */
const buildFailingInsertDb = (
    reason: unknown,
): DrizzleD1Database<typeof schema> => {
    const failing = {
        insert: () => ({
            values: () => ({
                onConflictDoUpdate: () => ({}),
            }),
        }),
        batch: () => Promise.reject(reason),
    };
    return failing as unknown as DrizzleD1Database<typeof schema>;
};

describe('PlaceRepository', () => {
    let repository: PlaceRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new PlaceRepository(drizzleGateway);
    });

    afterEach(() => {
        // クリーンアップ不要（各テストで新しいインメモリDBを作成するため）
    });

    describe('fetch', () => {
        // F1: 日付範囲でDBを検索しPlaceEntity配列を返す
        it('F1: 日付範囲でDBを検索しPlaceEntity配列を返す', async () => {
            const params: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01T00:00:00+09:00'),
                finishDate: new Date('2025-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.JRA],
            };
            await db.insert(schema.place).values({
                placeId: 'jra2025010101',
                raceType: 'jra',
                dateTime: '2025-01-01T09:00:00+09:00',
                locationCode: '01',
            });

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].placeId).toBe(validatePlaceId('jra2025010101'));
            expect(result[0].raceCourse).toBe('札幌');
        });

        // F2: finishDateはJST深夜0時として渡され、日末（23:59:59）への補正はされない
        // （raceRepositoryとは異なる実挙動。BETWEENの上限がfinishDate当日の0時になるため、
        // 当日中に発生したレコードはfinishDateの範囲から外れる）
        it('F2: finishDate当日の日中データはBETWEEN範囲外_finishDateは日末補正されないこと', async () => {
            const params: SearchPlaceFilterParamsInput = {
                startDate: new Date('2026-04-26T00:00:00+09:00'),
                finishDate: new Date('2026-04-28T00:00:00+09:00'),
                raceTypeList: [RaceType.JRA],
            };
            const days = [
                '2026-04-25',
                '2026-04-26',
                '2026-04-27',
                '2026-04-28',
            ];
            const locations = ['05', '06', '08', '09'];
            await db.insert(schema.place).values(
                days.map((day, index) => ({
                    placeId: `jra${day.replaceAll('-', '')}${locations[index]}`,
                    raceType: 'jra',
                    dateTime: `${day}T12:00:00+09:00`,
                    locationCode: locations[index],
                })),
            );

            const result = await repository.fetch(params);

            // 4/26・4/27（12時）のみ範囲内。4/25は範囲外（startDate未満）、
            // 4/28は日中（12時）が finishDate=4/28T00:00:00 の上限を超えるため範囲外
            expect(result).toHaveLength(2);
            expect(new Set(result.map((r) => r.locationCode))).toEqual(
                new Set([
                    validateLocationCode('06'),
                    validateLocationCode('08'),
                ]),
            );
        });

        // F3: locationList が指定されたとき該当ロケーションのみ返す
        it('F3: locationListが指定されたとき該当ロケーションのみ返す', async () => {
            const params: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01T00:00:00+09:00'),
                finishDate: new Date('2025-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.JRA],
                locationList: [validateLocationCode('01')],
            };
            await db.insert(schema.place).values([
                {
                    placeId: 'jra2025010101',
                    raceType: 'jra',
                    dateTime: '2025-01-01T09:00:00+09:00',
                    locationCode: '01',
                },
                {
                    placeId: 'jra2025010105',
                    raceType: 'jra',
                    dateTime: '2025-01-01T09:00:00+09:00',
                    locationCode: '05',
                },
            ]);

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].locationCode).toBe(validateLocationCode('01'));
        });

        // F4: gradeList が指定されたとき該当グレードのみ返す
        it('F4: gradeListが指定されたとき該当グレードのみ返す', async () => {
            const params: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01T00:00:00+09:00'),
                finishDate: new Date('2025-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.KEIRIN],
                gradeList: ['GⅠ'],
            };
            await db.insert(schema.place).values([
                {
                    placeId: 'keirin2025010143',
                    raceType: 'keirin',
                    dateTime: '2025-01-01T09:00:00+09:00',
                    locationCode: '43',
                },
                {
                    placeId: 'keirin2025010144',
                    raceType: 'keirin',
                    dateTime: '2025-01-01T09:00:00+09:00',
                    locationCode: '44',
                },
            ]);
            await db.insert(schema.placeGrade).values([
                { placeId: 'keirin2025010143', placeGrade: 'GⅠ' },
                { placeId: 'keirin2025010144', placeGrade: 'GⅡ' },
            ]);

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].placeId).toBe(validatePlaceId('keirin2025010143'));
            expect(result[0].placeGrade).toBe('GⅠ');
        });

        // F5: 該当データが無いとき空配列を返す
        it('F5: 該当データが無いとき空配列を返す', async () => {
            const params: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01T00:00:00+09:00'),
                finishDate: new Date('2025-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.NAR],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(0);
            expect(Array.isArray(result)).toBe(true);
        });

        // F8: 日付レンジに極端に大量の行がヒットしても防御的上限(10,000件)で
        // 切り詰められること（PERF-040）。locationCode固定・raceTypeをJRAに固定し、
        // 10,001個の異なる日付でplaceIdを一意にした行を投入する
        // （PlaceEntityはJRAの場合placeGrade/placeHeldDay不要のためplace単体で足りる）。
        it('F8: 10,001件ヒットしても10,000件に切り詰められる', async () => {
            const LOCATION_CODE = '01';
            const TOTAL_ROWS = 10_001;
            const CHUNK_SIZE = 1000;

            const placeRows: (typeof schema.place.$inferInsert)[] = [];
            for (let d = 0; placeRows.length < TOTAL_ROWS; d++) {
                const date = new Date(Date.UTC(2000, 0, 1) + d * 86_400_000);
                const dateStr = `${date.getUTCFullYear()}${String(
                    date.getUTCMonth() + 1,
                ).padStart(2, '0')}${String(date.getUTCDate()).padStart(
                    2,
                    '0',
                )}`;
                placeRows.push({
                    placeId: `jra${dateStr}${LOCATION_CODE}`,
                    raceType: 'jra',
                    dateTime: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T09:00:00+09:00`,
                    locationCode: LOCATION_CODE,
                });
            }
            for (let i = 0; i < placeRows.length; i += CHUNK_SIZE) {
                await db
                    .insert(schema.place)
                    .values(placeRows.slice(i, i + CHUNK_SIZE));
            }
            const params: SearchPlaceFilterParamsInput = {
                startDate: new Date('2000-01-01'),
                finishDate: new Date('2035-01-01'),
                raceTypeList: [RaceType.JRA],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(10_000);
        });

        // F7: スキーマ検証に失敗する行はスキップされ、有効な行のみ返る
        it('F7: 不正なplace行をスキップし有効なものを返す', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            const params: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01T00:00:00+09:00'),
                finishDate: new Date('2025-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.JRA],
            };
            // locationCode を不正な形式にすることで Mapper 内の validateLocationCode を失敗させる
            // （date_time は BETWEEN のWHERE句で絞り込まれるため範囲内の値を使う）
            await db.insert(schema.place).values({
                placeId: 'jra2025010101',
                raceType: 'jra',
                dateTime: '2025-01-01T09:00:00+09:00',
                locationCode: 'XX',
            });
            await db.insert(schema.place).values({
                placeId: 'jra2025010201',
                raceType: 'jra',
                dateTime: '2025-01-02T09:00:00+09:00',
                locationCode: '01',
            });

            const result = await repository.fetch(params);

            // 不正な行はスキップされ、有効な行のみが返される
            expect(result).toHaveLength(1);
            expect(result[0].placeId).toBe(validatePlaceId('jra2025010201'));

            // data_quality_warning_log へ記録される（GitHub Issue化の集計対象）
            const warningRows = await db
                .select()
                .from(schema.dataQualityWarningLog);
            expect(warningRows).toHaveLength(1);
            expect(warningRows[0].source).toBe('place_mapper');
            expect(warningRows[0].message).toContain('jra2025010101');

            consoleSpy.mockRestore();
        });

        // F6: DB(select)がエラーになったとき例外を伝播する
        it('F6: DBがエラーになったとき例外を伝播する', async () => {
            const failingGateway: IDrizzleGateway = {
                db: buildFailingSelectDb(
                    new Error('Database connection failed'),
                ),
            };
            repository = new PlaceRepository(failingGateway);
            const params: SearchPlaceFilterParamsInput = {
                startDate: new Date('2025-01-01T00:00:00+09:00'),
                finishDate: new Date('2025-01-31T00:00:00+09:00'),
                raceTypeList: [RaceType.JRA],
            };

            await expect(repository.fetch(params)).rejects.toThrow(
                'Database connection failed',
            );
        });
    });

    describe('upsert', () => {
        // U1: 単一PlaceEntityを正常にupsertする
        it('U1: 単一PlaceEntityを正常にupsertする_place/place_held_dayに永続化しplace_gradeは無い', async () => {
            const datetime = new Date('2025-01-01T00:00:00Z');
            const entity = generatePlaceEntity(
                RaceType.JRA,
                datetime,
                validateLocationCode('05'),
                undefined,
                { heldTimes: 3, heldDayTimes: 1 },
            );

            const result = await repository.upsert([entity]);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(0);

            const placeRows = await db
                .select()
                .from(schema.place)
                .where(eq(schema.place.placeId, entity.placeId));
            expect(placeRows).toHaveLength(1);
            expect(placeRows[0].dateTime).toBe('2025-01-01T09:00:00+09:00');

            const heldDayRows = await db
                .select()
                .from(schema.placeHeldDay)
                .where(eq(schema.placeHeldDay.placeId, entity.placeId));
            expect(heldDayRows).toEqual([
                expect.objectContaining({ heldTimes: 3, heldDayTimes: 1 }),
            ]);

            const gradeRows = await db
                .select()
                .from(schema.placeGrade)
                .where(eq(schema.placeGrade.placeId, entity.placeId));
            expect(gradeRows).toHaveLength(0);
        });

        // U2: 複数PlaceEntityを正常にupsertする
        it('U2: 複数PlaceEntityを正常にupsertする', async () => {
            const datetime = new Date('2025-01-01T00:00:00Z');
            const entities = [
                generatePlaceEntity(
                    RaceType.JRA,
                    datetime,
                    validateLocationCode('05'),
                    undefined,
                    { heldTimes: 3, heldDayTimes: 1 },
                ),
                generatePlaceEntity(
                    RaceType.JRA,
                    datetime,
                    validateLocationCode('08'),
                    undefined,
                    { heldTimes: 3, heldDayTimes: 1 },
                ),
            ];

            const result = await repository.upsert(entities);

            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);
            const placeRows = await db.select().from(schema.place);
            expect(placeRows).toHaveLength(2);
        });

        // U3: placeHeldDaysがあるとき実値でplace_held_dayに永続化する
        it('U3: placeHeldDaysがあるとき_held_times/held_day_timesの実値でplace_held_dayに永続化する', async () => {
            const datetime = new Date('2025-01-01T00:00:00Z');
            const entity = generatePlaceEntity(
                RaceType.JRA,
                datetime,
                validateLocationCode('05'),
                undefined,
                { heldTimes: 3, heldDayTimes: 1 },
            );

            await repository.upsert([entity]);

            const heldDayRows = await db
                .select()
                .from(schema.placeHeldDay)
                .where(eq(schema.placeHeldDay.placeId, entity.placeId));
            expect(heldDayRows).toHaveLength(1);
            expect(heldDayRows[0].heldTimes).toBe(3);
            expect(heldDayRows[0].heldDayTimes).toBe(1);
        });

        // U4: 機械レースタイプでplace_gradeを実値で永続化しDELETEは発生しない
        it('U4: 機械レースタイプでplace_gradeを実値で永続化する', async () => {
            const entity: PlaceEntity = {
                placeId: validatePlaceId('keirin2025010143'),
                raceType: RaceType.KEIRIN,
                datetime: new Date('2025-01-01T09:00:00Z'),
                raceCourse: '競輪門',
                locationCode: validateLocationCode('43'),
                placeGrade: 'GP',
            };

            const result = await repository.upsert([entity]);

            expect(result.successCount).toBe(1);
            const gradeRows = await db
                .select()
                .from(schema.placeGrade)
                .where(eq(schema.placeGrade.placeId, entity.placeId));
            expect(gradeRows).toEqual([
                expect.objectContaining({ placeGrade: 'GP' }),
            ]);
        });

        // U5: 非機械式タイプへ更新すると既存のplace_gradeが削除される
        it('U5: 非機械式タイプへ更新すると既存のplace_gradeが削除される', async () => {
            const entity: PlaceEntity = {
                placeId: validatePlaceId('jra2026072105'),
                raceType: RaceType.JRA,
                datetime: new Date('2026-07-21T00:00:00Z'),
                raceCourse: '東京',
                locationCode: validateLocationCode('05'),
            };
            // 以前は機械式だった等、既存のplace_gradeレコードがある状況を再現
            await db.insert(schema.place).values({
                placeId: entity.placeId,
                raceType: 'jra',
                dateTime: '2026-07-21T09:00:00+09:00',
                locationCode: '05',
            });
            await db
                .insert(schema.placeGrade)
                .values({ placeId: entity.placeId, placeGrade: 'GⅠ' });

            const result = await repository.upsert([entity]);

            expect(result.successCount).toBe(1);
            const gradeRows = await db
                .select()
                .from(schema.placeGrade)
                .where(eq(schema.placeGrade.placeId, entity.placeId));
            expect(gradeRows).toHaveLength(0);
        });

        // U9: isRaceListAvailable の true/false/undefined を 1/0/null で永続化する
        it('U9: isRaceListAvailable の true/false/undefined を 1/0/null で永続化する', async () => {
            const entities: PlaceEntity[] = [
                {
                    placeId: validatePlaceId('nar2026071420'),
                    raceType: RaceType.NAR,
                    datetime: new Date('2026-07-14T00:00:00Z'),
                    raceCourse: '大井',
                    locationCode: validateLocationCode('20'),
                    isRaceListAvailable: true,
                },
                {
                    placeId: validatePlaceId('nar2026072018'),
                    raceType: RaceType.NAR,
                    datetime: new Date('2026-07-20T00:00:00Z'),
                    raceCourse: '浦和',
                    locationCode: validateLocationCode('18'),
                    isRaceListAvailable: false,
                },
                {
                    placeId: validatePlaceId('jra2026072105'),
                    raceType: RaceType.JRA,
                    datetime: new Date('2026-07-21T00:00:00Z'),
                    raceCourse: '東京',
                    locationCode: validateLocationCode('05'),
                    placeHeldDays: { heldTimes: 1, heldDayTimes: 1 },
                },
            ];

            const result = await repository.upsert(entities);

            expect(result.successCount).toBe(3);
            const rows = await db
                .select({
                    placeId: schema.place.placeId,
                    isRaceListAvailable: schema.place.isRaceListAvailable,
                })
                .from(schema.place);
            const byId = Object.fromEntries(
                rows.map((r) => [r.placeId, r.isRaceListAvailable]),
            );
            expect(byId['nar2026071420']).toBe(1);
            expect(byId['nar2026072018']).toBe(0);
            expect(byId['jra2026072105']).toBeNull();
        });

        // U10: 旧形式のplace_idを持つ既存行がある場合でも(race_type,date_time,location_code)
        //      の複合キーでUPSERTし、place_idを新形式へ自己修復する（Issue #2505 回帰テスト）
        it('U10: 既存行のplace_idが現在の導出結果と異なる場合でも_複合キーでUPSERTしplace_idを更新する', async () => {
            const entity = generatePlaceEntity(
                RaceType.NAR,
                new Date('2026-08-14T00:00:00Z'),
                validateLocationCode('03'),
                undefined,
                undefined,
            );
            await repository.upsert([entity]);
            // 過去のID生成ロジック由来の旧形式place_idを持つ行を再現する
            // （race_type/date_time/location_codeは変えず、place_idのみ書き換える）
            await db
                .update(schema.place)
                .set({ placeId: 'nar_legacy_20260814_3' })
                .where(eq(schema.place.placeId, entity.placeId));

            const result = await repository.upsert([entity]);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(0);
            const placeRows = await db.select().from(schema.place);
            expect(placeRows).toHaveLength(1);
            expect(placeRows[0].placeId).toBe(entity.placeId);
        });

        // U8: 空entityListで空の成功結果を返す
        it('U8: 空entityListで空の成功結果を返す', async () => {
            const result = await repository.upsert([]);

            expect(result.successCount).toBe(0);
            expect(result.failureCount).toBe(0);
            const placeRows = await db.select().from(schema.place);
            expect(placeRows).toHaveLength(0);
        });

        // U7: DB(insert)がエラーになったときfailureCountを増やす
        it('U7: DBがエラーになったときfailureCountを増やす', async () => {
            const failingGateway: IDrizzleGateway = {
                db: buildFailingInsertDb(new Error('DB constraint violation')),
            };
            repository = new PlaceRepository(failingGateway);
            const entity = {
                placeId: validatePlaceId('jra2025010101'),
                raceType: RaceType.JRA,
                datetime: new Date('2025-01-01T09:00:00Z'),
                locationCode: validateLocationCode('01'),
                raceCourse: '東京',
            } satisfies PlaceEntity;

            const result = await repository.upsert([entity]);

            expect(result.failureCount).toBeGreaterThan(0);
            expect(result.failures.length).toBeGreaterThan(0);
        });
    });
});
