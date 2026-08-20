/**
 * raceRepository.test.ts - RaceRepository ユニットテスト
 *
 * @spec SPEC-PLAYER-001
 *
 * Drizzle化に伴い、SQL文字列のモックではなく bun:sqlite ベースの
 * インメモリD1（createInMemoryD1Database）に対して実際にクエリを実行する形へ変更した
 * （drizzle のクエリビルダはコンパイル時に組み立てられるため、
 * SQL文字列呼び出し検証では実質的な検証にならないため）。
 * DB障害系（F7/U4/P3/P4）のみ、実DBをラップして特定の呼び出しだけ reject する
 * フェイクの IDrizzleGateway を使う。
 *
 * ### メソッド: fetch()
 * | ケース | 入力 | DB状態 | 期待値 |
 * |--------|------|--------|--------|
 * | F1 | JRA raceTypeList | 有効な JRA レース行 | Array[RaceEntity] |
 * | F2 | KEIRIN raceTypeList | 有効な KEIRIN レース行 | raceStage を持つ Array[RaceEntity] |
 * | F3 | JRA raceTypeList | 無効なレース行 + 有効な行 | スキップ（ログ記録）、有効な行を返す |
 * | F4 | 空の raceTypeList | JRA 行 | Array[RaceEntity] |
 * | F5 | locationList 指定 | 2件（1件のみ一致） | 一致する1件のみ返す |
 * | F6 | gradeList 指定 | 2件（1件のみ一致） | 一致する1件のみ返す |
 * | F7 | 任意 | DB(select)がエラー | エラーを伝播する |
 * | F8 | locationList 未指定 | 2件（locationCode違い） | 両方返す（絞り込みなし） |
 * | F9 | gradeList 未指定 | 2件（grade違い） | 両方返す（絞り込みなし） |
 * | F10 | JRA+KEIRIN raceTypeList | 両方の行 | PERF-043: 両JOINを保持し両方返す |
 * | F11 | 全件対象 | 10,001件のレース行 | PERF-039: 10,000件に切り詰められる |
 *
 * ### メソッド: fetchByRaceId()
 * | ケース | 入力 | DB状態 | 期待値 |
 * |--------|------|--------|--------|
 * | B1 | 存在する raceId | 有効なレース行1件 | RaceEntity |
 * | B2 | 存在しない raceId | 空 | null |
 * | B3 | 存在する raceId | 無効なレース行 | null（警告ログ、例外は投げない） |
 *
 * ### メソッド: fetchWatchedRaceIds()（SPEC-PLAYER-001, KPLAYER-06）
 * | ケース | DB状態 | 入力raceIds | 期待値 |
 * |--------|--------|--------------|--------|
 * | W1 | race_player + player_watch(priority>0) がJOINする | 該当raceId | Setに含まれる |
 * | W2 | player_watch行はあるがpriority=0 | 該当raceId | Setに含まれない |
 * | W3 | player_watch行が無い（未登録選手のみ出走） | 該当raceId | Setに含まれない |
 * | W4 | -                                              | 空配列 | DBへ問い合わせず空のSetを返す |
 * | W5 | チャンクサイズ(99件)超のraceIdごとにJOINする行 | 100件のraceId | チャンク分割されても全件Setに含まれる（Issue #2350） |
 *
 * ### メソッド: fetchRacePlayers()（KPLAYER-07）
 * | ケース | DB状態 | 入力raceId | 期待値 |
 * |--------|--------|--------------|--------|
 * | P1 | race_player 2件（car_number降順で投入）+ player_keirin両方あり | 該当raceId | car_number昇順、term/branch付きで2件 |
 * | P2 | race_player 1件、対応するplayer_keirin行なし | 該当raceId | term/branchがundefinedの1件 |
 * | P3 | race_player行が無い | 該当raceId | 空配列 |
 * | P4 | race_player 1件（AUTORACE）+ player_autoraceあり | 該当raceId | termなし・branch(拠点/LG)付きの1件 |
 *
 * ### メソッド: upsert()
 * | ケース | エンティティリスト | 期待値 |
 * |--------|-------------------|--------|
 * | U1 | 単一 JRA エンティティ | race + race_condition がDBに永続化される |
 * | U2 | raceStage ありの KEIRIN エンティティ | race + race_stage がDBに永続化される |
 * | U3 | 空リスト | successCount=0、failureCount=0 を返す |
 * | U4 | DB(insert)がエラー | failureCount++ |
 * | U5 | チャンクサイズ（>12 エンティティ）| 複数チャンクに分割されても全件永続化される |
 *
 * ### メソッド: upsert() の孤児レコード削除（pruneStaleRaces）
 * | ケース | 既存DB race_id | 今回取得できた race_id | 期待値 |
 * |--------|-----------------|--------------------------|--------|
 * | P1 | 今回取得分に無い race_id を含む | 一部のみ | 差分の race_id を DELETE する |
 * | P2 | 今回取得分と完全一致 | 完全一致 | 何も削除されない |
 * | P3 | 別の開催場でチャンク失敗 | 失敗した開催場のみ | 失敗した開催場は削除対象から除外する |
 * | P4 | 削除対象あり | DB(select)がエラー | 例外を投げず upsert 自体は成功扱いのまま |
 * | P5 | 今回の取得期間より未来の日付の既存レースを含む | 過去分のみ | 未来のレースは fresh 集合に無くても削除しない（CONC-04） |
 * | P6 | 同一開催日内で、今回のfetch結果より後の時刻の末尾race_idを含む（開催打ち切り） | 打ち切り前のレースのみ | 同一開催日内なら削除する（打ち切りによるゴーストレース解消） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    type SearchRaceFilterParamsInput,
    toJstISOString,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import { eq } from 'drizzle-orm';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { RaceRepository } from '../../../../src/repository/implement/raceRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

const JRA_ENTITY: RaceEntity = {
    raceId: validateRaceId('jra202501010501'),
    placeId: validatePlaceId('jra2025010105'),
    raceType: RaceType.JRA,
    datetime: new Date('2025-01-01T00:00:00Z'),
    raceName: '有馬記念',
    raceNumber: 1,
    raceCourse: '東京',
    locationCode: validateLocationCode('05'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2000 },
    placeHeldDays: { heldTimes: 3, heldDayTimes: 1 },
};

const KEIRIN_ENTITY: RaceEntity = {
    raceId: validateRaceId('keirin202501011101'),
    placeId: validatePlaceId('keirin2025010111'),
    raceType: RaceType.KEIRIN,
    datetime: new Date('2025-01-01T00:00:00Z'),
    raceName: 'ケイリンレース',
    raceNumber: 1,
    raceCourse: '函館',
    locationCode: validateLocationCode('11'),
    raceGrade: 'GⅠ',
    raceStage: 'S級決勝',
};

/** playerList付きのKEIRINエンティティ（KPLAYER-05用フィクスチャ） */
const KEIRIN_ENTITY_WITH_PLAYERS: RaceEntity = {
    ...KEIRIN_ENTITY,
    playerList: [
        {
            carNumber: 1,
            frameNumber: 1,
            playerNo: '014833',
            playerName: '高久保雄介',
            term: 100,
            branch: '京都',
        },
        {
            carNumber: 2,
            frameNumber: 2,
            playerNo: '013679',
            playerName: '真崎新太郎',
            // term/branch省略（未取得ケースの再現）
        },
    ],
};

const AUTORACE_ENTITY: RaceEntity = {
    raceId: validateRaceId('autorace202501010401'),
    placeId: validatePlaceId('autorace2025010104'),
    raceType: RaceType.AUTORACE,
    datetime: new Date('2025-01-01T00:00:00Z'),
    raceName: 'オートレース',
    raceNumber: 1,
    raceCourse: '浜松',
    locationCode: validateLocationCode('04'),
    raceGrade: 'SG',
    raceStage: '優勝戦',
};

/** playerList付きのAUTORACEエンティティ（オートレース選手データ対応用フィクスチャ） */
const AUTORACE_ENTITY_WITH_PLAYERS: RaceEntity = {
    ...AUTORACE_ENTITY,
    playerList: [
        {
            carNumber: 1,
            frameNumber: 1,
            playerNo: '2809',
            playerName: '柴田 紘志',
            branch: '浜松',
        },
        {
            carNumber: 2,
            frameNumber: 2,
            playerNo: '2916',
            playerName: '関口 隆広',
            // branch省略（未取得ケースの再現）
        },
    ],
};

/** RaceEntity を race/race_condition/race_stage/place_held_day テーブルへ永続化する */
const seedRace = async (
    db: DrizzleD1Database<typeof schema>,
    entity: RaceEntity,
): Promise<void> => {
    await db.insert(schema.race).values({
        raceId: entity.raceId,
        placeId: entity.placeId,
        raceType: entity.raceType,
        raceName: entity.raceName,
        dateTime: toJstISOString(entity.datetime),
        locationCode: entity.locationCode,
        grade: entity.raceGrade,
        raceNumber: entity.raceNumber,
    });
    if (entity.conditionData) {
        await db.insert(schema.raceCondition).values({
            raceId: entity.raceId,
            distance: entity.conditionData.distance,
            surfaceType: entity.conditionData.surfaceType,
        });
    }
    if (entity.raceStage) {
        await db
            .insert(schema.raceStage)
            .values({ raceId: entity.raceId, raceStage: entity.raceStage });
    }
    if (entity.placeHeldDays) {
        await db.insert(schema.placeHeldDay).values({
            placeId: entity.placeId,
            heldTimes: entity.placeHeldDays.heldTimes,
            heldDayTimes: entity.placeHeldDays.heldDayTimes,
        });
    }
};

/** select チェーンが必ず reject する DrizzleD1Database の最小フェイク（F7用） */
const buildFailingSelectDb = (
    reason: unknown,
): DrizzleD1Database<typeof schema> => {
    const chain: Record<string, unknown> = {
        from: () => chain,
        leftJoin: () => chain,
        // PERF-043: fetch() が動的JOIN(`.leftJoin().$dynamic()`)を組み立てるため、
        // フェイクチェーンにも `$dynamic` を追加する（自身を返すだけでよい）。
        $dynamic: () => chain,
        where: () => chain,
        orderBy: () => chain,
        // PERF-039: fetch() が防御的上限として `.limit()` を呼ぶため、
        // フェイクチェーンにも追加する（自身を返すだけでよい）。
        limit: () => chain,
        then: (
            _resolve: (value: never) => void,
            reject: (reason: unknown) => void,
        ) => Promise.reject(reason).catch(reject),
    };
    const failing = { select: () => chain };
    return failing as unknown as DrizzleD1Database<typeof schema>;
};

/**
 * insert チェーンは実行しない無害な値を返し、batch() が必ず reject する
 * DrizzleD1Database の最小フェイク（U4用）。
 * @remarks
 * CONC-05でrace/race_stage/race_conditionへのINSERTが `db.batch()` 1回に
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

/**
 * 実DBをラップし、batch() の最初の1回だけ reject させ、以降は実DBへ委譲するフェイク（P3用）。
 * @remarks
 * 「開催場Aのチャンクだけ失敗し、開催場Bのチャンクは成功する」を実DB上で再現するための
 * 最小限のインターセプタ。CONC-05でrace/race_stage/race_conditionへのINSERTが
 * チャンクごとに1回の `db.batch()` 呼び出しにまとめられたため、intercept対象を
 * insert()からbatch()へ変更した（1チャンク＝1回のbatch呼び出しに対応する）。
 * batch以外（select/delete）は常に実DBへそのまま委譲する。
 */
const buildFailFirstInsertGateway = (
    real: DrizzleD1Database<typeof schema>,
    reason: unknown,
): IDrizzleGateway => {
    let batchCallCount = 0;
    const db = new Proxy(real, {
        get(target, prop, receiver) {
            if (prop === 'batch') {
                return (...args: unknown[]) => {
                    batchCallCount += 1;
                    if (batchCallCount === 1) {
                        return Promise.reject(reason);
                    }
                    const original = Reflect.get(target, prop, receiver) as (
                        ...a: unknown[]
                    ) => unknown;
                    return original.apply(target, args);
                };
            }
            return Reflect.get(target, prop, receiver);
        },
    });
    return { db };
};

/**
 * 実DBをラップし、select() を常に reject させ、insert/delete は実DBへ委譲するフェイク（P4用）。
 * @remarks upsert() 実行中に select() を呼ぶのは pruneStaleRaces のみのため成立する。
 */
const buildFailingPruneSelectGateway = (
    real: DrizzleD1Database<typeof schema>,
    reason: unknown,
): IDrizzleGateway => {
    const rejectingChain: Record<string, unknown> = {
        from: () => rejectingChain,
        where: () => rejectingChain,
        then: (
            _resolve: (value: never) => void,
            reject: (reason: unknown) => void,
        ) => Promise.reject(reason).catch(reject),
    };
    const db = new Proxy(real, {
        get(target, prop, receiver) {
            if (prop === 'select') {
                return () => rejectingChain;
            }
            return Reflect.get(target, prop, receiver);
        },
    });
    return { db };
};

describe('RaceRepository', () => {
    let repository: RaceRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new RaceRepository(drizzleGateway);
    });

    afterEach(() => {
        // クリーンアップ不要（各テストで新しいインメモリDBを作成するため）
    });

    describe('fetch', () => {
        // F1: JRA raceTypeList → 有効なエンティティを返す
        it('F1: JRA raceTypeListでRaceEntity配列を返す', async () => {
            await seedRace(db, JRA_ENTITY);
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].raceId).toBe(validateRaceId('jra202501010501'));
            expect(result[0].raceType).toBe('jra');
            expect(result[0].conditionData).toEqual({
                surfaceType: '芝',
                distance: 2000,
            });
        });

        // F2: KEIRIN raceTypeList → raceStage を含む
        it('F2: KEIRINでraceStage付きRaceEntityを返す', async () => {
            await seedRace(db, KEIRIN_ENTITY);
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.KEIRIN],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].raceType).toBe('keirin');
            expect(result[0].raceStage).toBe('S級決勝');
        });

        // F3: 無効なレース行 → スキップされ、有効な行を返す
        it('F3: 不正なrace行をスキップし有効なものを返す', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            await seedRace(db, JRA_ENTITY);
            // raceId の形式が不正な行（raceNameは検証を通す一方raceIdでEntity検証が失敗する）
            await db.insert(schema.race).values({
                raceId: 'jra-invalid-id',
                placeId: 'jra2025010109',
                raceType: 'jra',
                raceName: '不正レース',
                dateTime: '2025-01-02T09:00:00+09:00',
                locationCode: '09',
                grade: 'GⅠ',
                raceNumber: 1,
            });
            await db.insert(schema.raceCondition).values({
                raceId: 'jra-invalid-id',
                distance: 2000,
                surfaceType: '芝',
            });
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };

            const result = await repository.fetch(params);

            // 無効な行はスキップされ、有効な行が返される
            expect(result).toHaveLength(1);
            expect(result[0].raceId).toBe(validateRaceId('jra202501010501'));
            consoleSpy.mockRestore();
        });

        // F4: 空の raceTypeList → 全タイプを対象にする
        it('F4: raceTypeListが空のとき全race typeを検索する', async () => {
            await seedRace(db, JRA_ENTITY);
            await seedRace(db, KEIRIN_ENTITY);
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(2);
        });

        // F5: locationList 指定 → 一致するロケーションのみ返す
        it('F5: locationListが指定されたとき該当ロケーションのみ返す', async () => {
            await seedRace(db, JRA_ENTITY);
            await seedRace(db, {
                ...JRA_ENTITY,
                raceId: validateRaceId('jra202501010601'),
                placeId: validatePlaceId('jra2025010106'),
                locationCode: validateLocationCode('06'),
                placeHeldDays: undefined,
            });
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
                locationList: [validateLocationCode('05')],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].locationCode).toBe(validateLocationCode('05'));
        });

        // F6: gradeList 指定 → 一致するグレードのみ返す
        it('F6: gradeListが指定されたとき該当グレードのみ返す', async () => {
            await seedRace(db, JRA_ENTITY);
            await seedRace(db, {
                ...JRA_ENTITY,
                raceId: validateRaceId('jra202501010502'),
                raceNumber: 2,
                raceGrade: 'GⅡ',
                placeHeldDays: undefined,
            });
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
                gradeList: ['GⅠ'],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(1);
            expect(result[0].raceGrade).toBe('GⅠ');
        });

        // F8: locationList 未指定 → 絞り込みなしで両方のロケーションを返す（F5の否定ケース）
        it('F8: locationListが未指定のとき両方のロケーションを返す', async () => {
            await seedRace(db, JRA_ENTITY);
            await seedRace(db, {
                ...JRA_ENTITY,
                raceId: validateRaceId('jra202501010601'),
                placeId: validatePlaceId('jra2025010106'),
                locationCode: validateLocationCode('06'),
                placeHeldDays: undefined,
            });
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };

            const result = await repository.fetch(params);

            expect(new Set(result.map((r) => r.locationCode))).toEqual(
                new Set([
                    validateLocationCode('05'),
                    validateLocationCode('06'),
                ]),
            );
        });

        // F9: gradeList 未指定 → 絞り込みなしで両方のグレードを返す（F6の否定ケース）
        it('F9: gradeListが未指定のとき両方のグレードを返す', async () => {
            await seedRace(db, JRA_ENTITY);
            await seedRace(db, {
                ...JRA_ENTITY,
                raceId: validateRaceId('jra202501010502'),
                raceNumber: 2,
                raceGrade: 'GⅡ',
                placeHeldDays: undefined,
            });
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };

            const result = await repository.fetch(params);

            expect(new Set(result.map((r) => r.raceGrade))).toEqual(
                new Set(['GⅠ', 'GⅡ']),
            );
        });

        // F10: raceTypeListに競馬系(JRA)と機械式(KEIRIN)が混在する場合、
        // PERF-043のJOIN絞り込みで両方のJOIN(race_condition/race_stage)が
        // 保持され、両タイプとも正しくEntity化されることを確認する。
        it('F10: JRA+KEIRINが混在するraceTypeListで両方のJOINを保持し両方返す', async () => {
            await seedRace(db, JRA_ENTITY);
            await seedRace(db, KEIRIN_ENTITY);
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA, RaceType.KEIRIN],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(2);
            const jraResult = result.find((r) => r.raceType === RaceType.JRA);
            const keirinResult = result.find(
                (r) => r.raceType === RaceType.KEIRIN,
            );
            expect(jraResult?.conditionData).toEqual({
                surfaceType: '芝',
                distance: 2000,
            });
            expect(keirinResult?.raceStage).toBe('S級決勝');
        });

        // F11: 日付レンジに極端に大量の行がヒットしても防御的上限(10,000件)で
        // 切り詰められること（PERF-039）。KEIRIN(locationCode固定・raceStage必須のみで
        // conditionData/placeHeldDaysが不要なため大量データ生成に適する)で
        // raceNumberは1〜12(RaceNumberSchemaの制約)しか使えないため、834日 ×
        // raceNumber(1-12)のうち10,001件をrace/race_stageへ投入し、
        // 返却されるのが10,000件に切り詰められることを検証する。
        it('F11: 10,001件ヒットしても10,000件に切り詰められる', async () => {
            const RACE_TYPE = 'keirin';
            const LOCATION_CODE = '11';
            const TOTAL_ROWS = 10_001;
            const CHUNK_SIZE = 500;

            const raceRows: (typeof schema.race.$inferInsert)[] = [];
            for (let d = 0; raceRows.length < TOTAL_ROWS; d++) {
                const date = new Date(Date.UTC(2020, 0, 1) + d * 86_400_000);
                const dateStr = `${date.getUTCFullYear()}${String(
                    date.getUTCMonth() + 1,
                ).padStart(2, '0')}${String(date.getUTCDate()).padStart(
                    2,
                    '0',
                )}`;
                for (
                    let raceNumber = 1;
                    raceNumber <= 12 && raceRows.length < TOTAL_ROWS;
                    raceNumber++
                ) {
                    raceRows.push({
                        raceId: `${RACE_TYPE}${dateStr}${LOCATION_CODE}${String(
                            raceNumber,
                        ).padStart(2, '0')}`,
                        placeId: `${RACE_TYPE}${dateStr}${LOCATION_CODE}`,
                        raceType: RACE_TYPE,
                        raceName: 'テストレース',
                        dateTime: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T09:00:00+09:00`,
                        locationCode: LOCATION_CODE,
                        grade: 'GⅠ',
                        raceNumber,
                    });
                }
            }
            const raceStageRows = raceRows.map((row) => ({
                raceId: row.raceId,
                raceStage: 'S級決勝',
            }));
            for (let i = 0; i < raceRows.length; i += CHUNK_SIZE) {
                await db
                    .insert(schema.race)
                    .values(raceRows.slice(i, i + CHUNK_SIZE));
            }
            for (let i = 0; i < raceStageRows.length; i += CHUNK_SIZE) {
                await db
                    .insert(schema.raceStage)
                    .values(raceStageRows.slice(i, i + CHUNK_SIZE));
            }
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2020-01-01'),
                finishDate: new Date('2030-01-01'),
                raceTypeList: [RaceType.KEIRIN],
            };

            const result = await repository.fetch(params);

            expect(result).toHaveLength(10_000);
        });

        // F7: DB(select)がエラーになったとき例外を伝播する
        it('F7: DBがエラーになったとき例外を伝播する', async () => {
            const failingGateway: IDrizzleGateway = {
                db: buildFailingSelectDb(new Error('DB error')),
            };
            repository = new RaceRepository(failingGateway);
            const params: SearchRaceFilterParamsInput = {
                startDate: new Date('2025-01-01'),
                finishDate: new Date('2025-01-31'),
                raceTypeList: [RaceType.JRA],
            };

            await expect(repository.fetch(params)).rejects.toThrow('DB error');
        });
    });

    describe('fetchByRaceId', () => {
        // B1: 存在する raceId → RaceEntity を返す
        it('B1: 存在するraceIdに対してRaceEntityを返す', async () => {
            await seedRace(db, JRA_ENTITY);

            const result = await repository.fetchByRaceId(
                validateRaceId('jra202501010501'),
            );

            expect(result).not.toBeNull();
            expect(result?.raceId).toBe(validateRaceId('jra202501010501'));
        });

        // B2: 存在しない raceId → null を返す
        it('B2: 存在しないraceIdに対してnullを返す', async () => {
            const result = await repository.fetchByRaceId(
                validateRaceId('jra209901010101'),
            );

            expect(result).toBeNull();
        });

        // B3: 無効なレース行 → null を返す（例外を投げない）
        it('B3: 無効なレース行に対してnullを返す', async () => {
            // raceName を空文字にすることで RaceEntitySchema の検証を失敗させる
            await db.insert(schema.race).values({
                raceId: 'jra202501010501',
                placeId: 'jra2025010105',
                raceType: 'jra',
                raceName: '',
                dateTime: '2025-01-01T09:00:00+09:00',
                locationCode: '05',
                grade: 'GⅠ',
                raceNumber: 1,
            });

            const result = await repository.fetchByRaceId(
                validateRaceId('jra202501010501'),
            );

            expect(result).toBeNull();
        });
    });

    describe('fetchWatchedRaceIds', () => {
        const seedWatchedFixture = async (
            watchPriority: number,
        ): Promise<void> => {
            await db.insert(schema.racePlayer).values({
                racePlayerId: `${KEIRIN_ENTITY.raceId}01`,
                raceId: KEIRIN_ENTITY.raceId,
                raceType: 'keirin',
                carNumber: 1,
                frameNumber: 1,
                playerNo: '014833',
                playerName: '高久保雄介',
            });
            await db.insert(schema.playerWatch).values({
                userId: 'test-user-id',
                raceType: 'keirin',
                playerNo: '014833',
                priority: watchPriority,
            });
        };

        // W1: race_player + player_watch(priority>0) がJOINする → Setに含まれる
        it('W1: 注目選手(priority>0)が出走するraceIdを返す', async () => {
            await seedWatchedFixture(10);

            const result = await repository.fetchWatchedRaceIds([
                KEIRIN_ENTITY.raceId,
            ]);

            expect(result).toEqual(new Set([KEIRIN_ENTITY.raceId]));
        });

        // W2: player_watch行はあるがpriority=0 → Setに含まれない
        it('W2: priority=0の選手が出走するraceIdはSetに含まれない', async () => {
            await seedWatchedFixture(0);

            const result = await repository.fetchWatchedRaceIds([
                KEIRIN_ENTITY.raceId,
            ]);

            expect(result).toEqual(new Set());
        });

        // W3: player_watch行が無い（未登録選手のみ出走） → Setに含まれない
        it('W3: player_watchに登録の無い選手のみのraceIdはSetに含まれない', async () => {
            await db.insert(schema.racePlayer).values({
                racePlayerId: `${KEIRIN_ENTITY.raceId}01`,
                raceId: KEIRIN_ENTITY.raceId,
                raceType: 'keirin',
                carNumber: 1,
                frameNumber: 1,
                playerNo: '999999',
                playerName: '未登録選手',
            });

            const result = await repository.fetchWatchedRaceIds([
                KEIRIN_ENTITY.raceId,
            ]);

            expect(result).toEqual(new Set());
        });

        // W4: 空配列 → DBへ問い合わせず空のSetを返す
        it('W4: 空配列を渡すと空のSetを返す', async () => {
            const result = await repository.fetchWatchedRaceIds([]);

            expect(result).toEqual(new Set());
        });

        // W5: チャンクサイズ(99件)を超えるraceIds → チャンク分割されても全件検出する
        // (D1のバインド変数上限超過でクエリ全体が失敗しないことの回帰テスト。Issue #2350)
        it('W5: チャンクサイズ(99件)を超えるraceIdsを渡してもチャンク分割して全件検出する', async () => {
            const raceIds = Array.from(
                { length: 100 },
                (_, i) => `keirin2025010111${String(i).padStart(2, '0')}`,
            );
            await db.insert(schema.racePlayer).values(
                raceIds.map((raceId) => ({
                    racePlayerId: `${raceId}01`,
                    raceId,
                    raceType: 'keirin',
                    carNumber: 1,
                    frameNumber: 1,
                    playerNo: '014833',
                    playerName: '高久保雄介',
                })),
            );
            await db.insert(schema.playerWatch).values({
                userId: 'test-user-id',
                raceType: 'keirin',
                playerNo: '014833',
                priority: 10,
            });

            const result = await repository.fetchWatchedRaceIds(raceIds);

            expect(result).toEqual(new Set(raceIds));
        });
    });

    describe('fetchRacePlayers', () => {
        // P1: race_player 2件（car_number降順で投入）+ player_keirin両方あり
        //     → car_number昇順、term/branch付きで2件返る
        it('P1: 出走選手一覧を車番昇順・term/branch付きで返す', async () => {
            await db.insert(schema.player).values([
                {
                    raceType: 'keirin',
                    playerNo: '014833',
                    playerName: '高久保雄介',
                    priority: 0,
                },
                {
                    raceType: 'keirin',
                    playerNo: '014834',
                    playerName: '梁島邦友',
                    priority: 0,
                },
            ]);
            await db.insert(schema.playerKeirin).values([
                { playerNo: '014833', term: 100, branch: '京都' },
                { playerNo: '014834', term: 101, branch: '神奈' },
            ]);
            // 車番の降順で投入し、返り値が車番昇順に並び替わることを検証する
            await db.insert(schema.racePlayer).values([
                {
                    racePlayerId: `${KEIRIN_ENTITY.raceId}02`,
                    raceId: KEIRIN_ENTITY.raceId,
                    raceType: 'keirin',
                    carNumber: 2,
                    frameNumber: 2,
                    playerNo: '014834',
                    playerName: '梁島邦友',
                },
                {
                    racePlayerId: `${KEIRIN_ENTITY.raceId}01`,
                    raceId: KEIRIN_ENTITY.raceId,
                    raceType: 'keirin',
                    carNumber: 1,
                    frameNumber: 1,
                    playerNo: '014833',
                    playerName: '高久保雄介',
                },
            ]);

            const result = await repository.fetchRacePlayers(
                KEIRIN_ENTITY.raceId,
            );

            expect(result).toEqual([
                {
                    carNumber: 1,
                    frameNumber: 1,
                    playerNo: '014833',
                    playerName: '高久保雄介',
                    term: 100,
                    branch: '京都',
                },
                {
                    carNumber: 2,
                    frameNumber: 2,
                    playerNo: '014834',
                    playerName: '梁島邦友',
                    term: 101,
                    branch: '神奈',
                },
            ]);
        });

        // P2: race_player 1件、対応するplayer_keirin行なし
        //     → term/branchがundefinedの1件を返す
        it('P2: player_keirinに未紐付けの選手はterm/branch無しで返す', async () => {
            await db.insert(schema.racePlayer).values({
                racePlayerId: `${KEIRIN_ENTITY.raceId}01`,
                raceId: KEIRIN_ENTITY.raceId,
                raceType: 'keirin',
                carNumber: 1,
                frameNumber: 1,
                playerNo: '999999',
                playerName: '未紐付け選手',
            });

            const result = await repository.fetchRacePlayers(
                KEIRIN_ENTITY.raceId,
            );

            expect(result).toEqual([
                {
                    carNumber: 1,
                    frameNumber: 1,
                    playerNo: '999999',
                    playerName: '未紐付け選手',
                },
            ]);
        });

        // P3: race_player行が無い → 空配列を返す
        it('P3: race_player行が無い場合空配列を返す', async () => {
            const result = await repository.fetchRacePlayers(
                KEIRIN_ENTITY.raceId,
            );

            expect(result).toEqual([]);
        });

        // P4: race_player 1件 + player_autoraceあり（AUTORACE）
        //     → term無し・branch(拠点/LG)付きの1件を返す
        it('P4: AUTORACEの出走選手一覧をplayer_autoraceのbranch付きで返す', async () => {
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
            await db.insert(schema.racePlayer).values({
                racePlayerId: `${AUTORACE_ENTITY.raceId}01`,
                raceId: AUTORACE_ENTITY.raceId,
                raceType: 'autorace',
                carNumber: 1,
                frameNumber: 1,
                playerNo: '2809',
                playerName: '柴田 紘志',
            });

            const result = await repository.fetchRacePlayers(
                AUTORACE_ENTITY.raceId,
            );

            expect(result).toEqual([
                {
                    carNumber: 1,
                    frameNumber: 1,
                    playerNo: '2809',
                    playerName: '柴田 紘志',
                    branch: '浜松',
                },
            ]);
        });
    });

    describe('upsert', () => {
        // U1: 単一 JRA エンティティ → race + race_condition が永続化される
        it('U1: JRAエンティティを処理しrace+conditionDataを永続化する', async () => {
            const result = await repository.upsert([JRA_ENTITY]);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(0);
            const raceRows = await db
                .select()
                .from(schema.race)
                .where(eq(schema.race.raceId, JRA_ENTITY.raceId));
            expect(raceRows).toHaveLength(1);
            const conditionRows = await db
                .select()
                .from(schema.raceCondition)
                .where(eq(schema.raceCondition.raceId, JRA_ENTITY.raceId));
            expect(conditionRows).toEqual([
                expect.objectContaining({ distance: 2000, surfaceType: '芝' }),
            ]);
        });

        // U2: raceStage ありの KEIRIN エンティティ → race + race_stage が永続化される
        it('U2: KEIRINエンティティを処理しrace+raceStageを永続化する', async () => {
            const result = await repository.upsert([KEIRIN_ENTITY]);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(0);
            const stageRows = await db
                .select()
                .from(schema.raceStage)
                .where(eq(schema.raceStage.raceId, KEIRIN_ENTITY.raceId));
            expect(stageRows).toEqual([
                expect.objectContaining({ raceStage: 'S級決勝' }),
            ]);
        });

        // U3: 空リスト → successCount=0 を返す
        it('U3: 空エンティティリストで空の結果を返す', async () => {
            const result = await repository.upsert([]);

            expect(result.successCount).toBe(0);
            expect(result.failureCount).toBe(0);
        });

        // U4: DB(insert)がエラーになったときfailureCountを増やす
        it('U4: DBがエラーになったときfailureCountを増やす', async () => {
            const failingGateway: IDrizzleGateway = {
                db: buildFailingInsertDb(new Error('Insert failed')),
            };
            repository = new RaceRepository(failingGateway);

            const result = await repository.upsert([JRA_ENTITY]);

            expect(result.failureCount).toBe(1);
            expect(result.successCount).toBe(0);
            expect(result.failures).toHaveLength(1);
        });

        // U5: 12件超のエンティティ → チャンクに分割されても全件永続化される
        // (successCount===13 だけでは「1チャンクで13件まとめて処理された」場合と
        //  区別できないため、DBに実際に永続化された raceId の集合まで検証する)
        it('U5: 12件超のエンティティをチャンクで処理しても全件永続化する', async () => {
            const entities: RaceEntity[] = Array.from(
                { length: 13 },
                (_, i) => ({
                    ...JRA_ENTITY,
                    raceId: validateRaceId(
                        `jra2025010105${String(i + 1).padStart(2, '0')}`,
                    ),
                    raceNumber: i + 1,
                    placeHeldDays: undefined,
                }),
            );
            const raceIds = entities.map((entity) => entity.raceId);

            const result = await repository.upsert(entities);

            expect(result.successCount).toBe(13);
            expect(result.failureCount).toBe(0);
            const raceRows = await db.select().from(schema.race);
            expect(raceRows).toHaveLength(13);
            expect(new Set(raceRows.map((r) => r.raceId))).toEqual(
                new Set(raceIds),
            );
        });

        // U6: JRA + KEIRIN 混在エンティティ → 両方処理される
        it('U6: JRAとKEIRINの混在エンティティを処理する', async () => {
            const result = await repository.upsert([JRA_ENTITY, KEIRIN_ENTITY]);

            expect(result.successCount).toBe(2);
            expect(result.failureCount).toBe(0);
        });

        // U7: playerList付きKEIRINエンティティ → race_player/player/player_keirin
        //     が永続化される（KPLAYER-05）
        it('U7: playerList付きKEIRINエンティティでrace_player/player/player_keirinを永続化する', async () => {
            const result = await repository.upsert([
                KEIRIN_ENTITY_WITH_PLAYERS,
            ]);

            expect(result.successCount).toBe(1);
            const racePlayerRows = await db
                .select()
                .from(schema.racePlayer)
                .where(
                    eq(
                        schema.racePlayer.raceId,
                        KEIRIN_ENTITY_WITH_PLAYERS.raceId,
                    ),
                );
            expect(racePlayerRows).toHaveLength(2);
            expect(
                racePlayerRows.find((r) => r.carNumber === 1)?.racePlayerId,
            ).toBe(`${KEIRIN_ENTITY_WITH_PLAYERS.raceId}01`);
            const playerRows = await db.select().from(schema.player);
            expect(new Set(playerRows.map((r) => r.playerNo))).toEqual(
                new Set(['014833', '013679']),
            );
            // player.priorityは常に0固定（player_watchが正）
            expect(playerRows.every((r) => r.priority === 0)).toBe(true);
            // term/branchが揃っている選手（014833）のみplayer_keirinへ書き込まれる
            const keirinRows = await db.select().from(schema.playerKeirin);
            expect(keirinRows).toHaveLength(1);
            expect(keirinRows[0].playerNo).toBe('014833');
            expect(keirinRows[0].term).toBe(100);
            expect(keirinRows[0].branch).toBe('京都');
        });

        // U8: 同一選手が複数レースに出走 → playerテーブルに重複なく1行
        it('U8: 同一選手が複数レースに出走してもplayerテーブルは重複しない', async () => {
            const secondRace: RaceEntity = {
                ...KEIRIN_ENTITY_WITH_PLAYERS,
                raceId: validateRaceId('keirin202501011102'),
                raceNumber: 2,
                playerList: [
                    {
                        carNumber: 1,
                        frameNumber: 1,
                        playerNo: '014833',
                        playerName: '高久保雄介',
                        term: 100,
                        branch: '京都',
                    },
                ],
            };

            await repository.upsert([KEIRIN_ENTITY_WITH_PLAYERS, secondRace]);

            const playerRows = await db
                .select()
                .from(schema.player)
                .where(eq(schema.player.playerNo, '014833'));
            expect(playerRows).toHaveLength(1);
            // 両レース分のrace_playerは別行として残る
            const racePlayerRows = await db
                .select()
                .from(schema.racePlayer)
                .where(eq(schema.racePlayer.playerNo, '014833'));
            expect(racePlayerRows).toHaveLength(2);
        });

        // U11: playerList付きAUTORACEエンティティ → race_player/player/player_autorace
        //      が永続化される（player_keirinへは書き込まれない）
        it('U11: playerList付きAUTORACEエンティティでrace_player/player/player_autoraceを永続化する', async () => {
            const result = await repository.upsert([
                AUTORACE_ENTITY_WITH_PLAYERS,
            ]);

            expect(result.successCount).toBe(1);
            const racePlayerRows = await db
                .select()
                .from(schema.racePlayer)
                .where(
                    eq(
                        schema.racePlayer.raceId,
                        AUTORACE_ENTITY_WITH_PLAYERS.raceId,
                    ),
                );
            expect(racePlayerRows).toHaveLength(2);
            const playerRows = await db.select().from(schema.player);
            expect(new Set(playerRows.map((r) => r.playerNo))).toEqual(
                new Set(['2809', '2916']),
            );
            // branchが揃っている選手（2809）のみplayer_autoraceへ書き込まれる
            const autoraceRows = await db.select().from(schema.playerAutorace);
            expect(autoraceRows).toHaveLength(1);
            expect(autoraceRows[0].playerNo).toBe('2809');
            expect(autoraceRows[0].branch).toBe('浜松');
            // AUTORACEの選手はplayer_keirinへは書き込まれない（raceType不一致）
            const keirinRows = await db.select().from(schema.playerKeirin);
            expect(keirinRows).toHaveLength(0);
        });

        // U9: 非機械式（JRA）のraceIdに対しては既存のrace_player行が削除される
        it('U9: 非機械式のraceIdに対して既存race_player行を削除する', async () => {
            // 元はKEIRIN想定だったraceIdにrace_player行が残っている状況を再現
            await db.insert(schema.racePlayer).values({
                racePlayerId: `${JRA_ENTITY.raceId}01`,
                raceId: JRA_ENTITY.raceId,
                raceType: 'keirin',
                carNumber: 1,
                frameNumber: 1,
                playerNo: '014833',
                playerName: '高久保雄介',
            });

            await repository.upsert([JRA_ENTITY]);

            const rows = await db
                .select()
                .from(schema.racePlayer)
                .where(eq(schema.racePlayer.raceId, JRA_ENTITY.raceId));
            expect(rows).toHaveLength(0);
        });

        // U10: 出走表から消えた選手（欠場等）のrace_player行がpruneされる（KPLAYER-05, PERF-038同様の設計）
        it('U10: 前回の出走表にいたが今回いなくなった選手のrace_player行が削除される', async () => {
            await repository.upsert([KEIRIN_ENTITY_WITH_PLAYERS]);
            const withdrawnEntity: RaceEntity = {
                ...KEIRIN_ENTITY_WITH_PLAYERS,
                playerList: [
                    KEIRIN_ENTITY_WITH_PLAYERS.playerList?.[0] as NonNullable<
                        RaceEntity['playerList']
                    >[number],
                ],
            };

            await repository.upsert([withdrawnEntity]);

            const rows = await db
                .select()
                .from(schema.racePlayer)
                .where(
                    eq(
                        schema.racePlayer.raceId,
                        KEIRIN_ENTITY_WITH_PLAYERS.raceId,
                    ),
                );
            expect(rows).toHaveLength(1);
            expect(rows[0].carNumber).toBe(1);
        });

        // P1: 今回取得分に無い race_id を含む → 差分の race_id を削除する
        it('P1: 現在のfetch結果にない古いrace_idを削除する', async () => {
            await seedRace(db, JRA_ENTITY);
            const staleRaceId = validateRaceId('jra202501010502');
            await seedRace(db, {
                ...JRA_ENTITY,
                raceId: staleRaceId,
                raceNumber: 2,
                placeHeldDays: undefined,
            });

            const result = await repository.upsert([JRA_ENTITY]);

            expect(result.successCount).toBe(1);
            const staleRows = await db
                .select()
                .from(schema.race)
                .where(eq(schema.race.raceId, staleRaceId));
            expect(staleRows).toHaveLength(0);
            const keptRows = await db
                .select()
                .from(schema.race)
                .where(eq(schema.race.raceId, JRA_ENTITY.raceId));
            expect(keptRows).toHaveLength(1);
        });

        // P2: 今回取得分と完全一致 → 何も削除されない
        it('P2: fetch結果が既存DB行と完全一致するとき何も削除しない', async () => {
            await seedRace(db, JRA_ENTITY);

            await repository.upsert([JRA_ENTITY]);

            const rows = await db.select().from(schema.race);
            expect(rows).toHaveLength(1);
        });

        // P3: 別の開催場でチャンク失敗 → 失敗した開催場は削除対象から除外する
        it('P3: チャンク失敗したplaceIdをpruning対象から除外する', async () => {
            const consoleSpy = spyOn(console, 'warn').mockImplementation(
                () => {},
            );
            const realDb = db;
            const failFirstGateway = buildFailFirstInsertGateway(
                realDb,
                new Error('Insert failed for bad place'),
            );
            repository = new RaceRepository(failFirstGateway);

            // 11件（=RACE_UPSERT_CHUNK_SIZE）の「失敗させたい開催場」チャンク
            // （ちょうど1チャンク分に揃えることで、1チャンク目が丸ごと失敗し
            // JRA_ENTITYは別チャンクで成功する、という境界を固定する）
            const badPlaceEntities: RaceEntity[] = Array.from(
                { length: 11 },
                (_, i) => ({
                    ...JRA_ENTITY,
                    placeId: validatePlaceId('jra2025010199'),
                    raceId: validateRaceId(
                        `jra2025010199${String(i + 1).padStart(2, '0')}`,
                    ),
                    raceNumber: i + 1,
                    placeHeldDays: undefined,
                }),
            );

            const result = await repository.upsert([
                ...badPlaceEntities,
                JRA_ENTITY,
            ]);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(11);
            // 失敗した開催場(jra2025010199)のレースはpruning対象(placeIdToFreshRaceIds)
            // から除外されるため、PERF-038の集約SELECT(WHERE place_id IN (...))の
            // 対象にも含まれない
            // = 実DBに badPlace のレースは1件も残っていない（そもそもinsert自体が失敗したため）
            const badPlaceRows = await realDb
                .select()
                .from(schema.race)
                .where(eq(schema.race.placeId, 'jra2025010199'));
            expect(badPlaceRows).toHaveLength(0);
            const goodPlaceRows = await realDb
                .select()
                .from(schema.race)
                .where(eq(schema.race.raceId, JRA_ENTITY.raceId));
            expect(goodPlaceRows).toHaveLength(1);
            consoleSpy.mockRestore();
        });

        // P4: pruning中のDB(select)失敗 → 例外を投げずupsert結果を保つ
        it('P4: pruning中にDBが失敗してもthrowせずupsert結果を保つ', async () => {
            const failingPruneGateway = buildFailingPruneSelectGateway(
                db,
                new Error('DB unavailable'),
            );
            repository = new RaceRepository(failingPruneGateway);

            const result = await repository.upsert([JRA_ENTITY]);

            expect(result.successCount).toBe(1);
            expect(result.failureCount).toBe(0);
        });

        // P5 (CONC-04): 今回の取得期間より後の日付にある既存レースは、fresh集合に
        // 含まれていなくても削除しない（狭い期間の同期が、広い期間の同期が正当に
        // 登録した未来のレースを誤ってstale判定して削除してしまう回帰の防止）。
        it('P5: 今回の取得期間より未来の既存レースはfresh集合に無くても削除しない（CONC-04）', async () => {
            const futureRaceId = validateRaceId('jra202501080501');
            await seedRace(db, JRA_ENTITY);
            await seedRace(db, {
                ...JRA_ENTITY,
                raceId: futureRaceId,
                datetime: new Date('2025-01-08T00:00:00Z'),
                raceNumber: 2,
                placeHeldDays: undefined,
            });

            // 今回のfetchはJRA_ENTITY（2025-01-01分）のみを対象にした狭い期間の同期。
            const result = await repository.upsert([JRA_ENTITY]);

            expect(result.successCount).toBe(1);
            const futureRows = await db
                .select()
                .from(schema.race)
                .where(eq(schema.race.raceId, futureRaceId));
            expect(futureRows).toHaveLength(1);
        });

        // P6: 開催が打ち切りになり、同一開催日内で末尾のレースが丸ごと欠落した
        // ケース（例: 12R予定が落車多発で11Rで打ち切り）でも、実在しなくなった
        // 末尾レースのゴーストレコードは削除する。
        it('P6: 同一開催日内の打ち切りによる末尾ゴーストレースを削除する', async () => {
            await seedRace(db, KEIRIN_ENTITY);
            const ghostRaceId = validateRaceId('keirin202501011112');
            await seedRace(db, {
                ...KEIRIN_ENTITY,
                raceId: ghostRaceId,
                raceNumber: 12,
                // 同一開催日（JST）内だが、今回のfetch結果（KEIRIN_ENTITY）より
                // 後の時刻＝末尾のレースを想定
                datetime: new Date('2025-01-01T12:00:00Z'),
            });

            const result = await repository.upsert([KEIRIN_ENTITY]);

            expect(result.successCount).toBe(1);
            const ghostRows = await db
                .select()
                .from(schema.race)
                .where(eq(schema.race.raceId, ghostRaceId));
            expect(ghostRows).toHaveLength(0);
            const keptRows = await db
                .select()
                .from(schema.race)
                .where(eq(schema.race.raceId, KEIRIN_ENTITY.raceId));
            expect(keptRows).toHaveLength(1);
        });
    });
});
