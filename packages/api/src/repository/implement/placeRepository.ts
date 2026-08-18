import {
    appLogger,
    createEmptyUpsertResult,
    createErrorMessage,
    DI_TOKENS,
    isMechanicalRace,
    LogAllMethods,
    type PlaceEntity,
    type SearchPlaceFilterParamsInput,
    toJstISOString,
    type UpsertResult,
} from '@race-schedule/core';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import { place, placeGrade, placeHeldDay } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type { IPlaceRepository } from '../interface/IPlaceRepository';
import { recordDataQualityWarning } from '../utility/dataQualityWarningLogger';
import { processInChunks } from '../utility/processInChunks';
import {
    FETCH_ROW_LIMIT,
    hasFilterValues,
} from '../utility/queryFilterHelpers';
import { resolveUpsertChunkSize } from '../utility/upsertChunk';
import {
    recordUpsertChunkFailure,
    recordUpsertChunkSuccess,
} from '../utility/upsertResultAggregator';
import { PlaceMapper } from './placeMapper';

/**
 * place テーブル 1 行あたりのバインド変数数
 * （batchInsertPlace の columns 数。バッチ内で最も列数が多く、上限を決める）
 */
const PLACE_INSERT_PARAMS_PER_ROW = 5;

/**
 * upsert のチャンクサイズ
 * （D1 のバインド変数上限を 1 行あたりの変数数で割った値: floor(100 / 5) = 20）
 */
const PLACE_UPSERT_CHUNK_SIZE = resolveUpsertChunkSize(
    PLACE_INSERT_PARAMS_PER_ROW,
);

/**
 * fetch で place_grade を JOIN すべきかを判定する。
 * 「機械式種別が対象」「gradeList フィルタが指定されている」のいずれかを満たせば対象。
 * 呼び出し側にインライン展開すると3項の複合条件になるため、単独テスト可能な関数として切り出す。
 * @param raceTypeList - 検索対象の race_type リスト
 * @param gradeList - grade によるフィルタ（未指定可）
 */
const isPlaceGradeJoinNeeded = (
    raceTypeList: SearchPlaceFilterParamsInput['raceTypeList'],
    gradeList: SearchPlaceFilterParamsInput['gradeList'],
): boolean =>
    raceTypeList.some((rt) => isMechanicalRace(rt)) ||
    (gradeList !== undefined && gradeList.length > 0);

/**
 * fetch の WHERE 句条件一覧を組み立てる。
 * @param params - 検索フィルタパラメータ
 */
const buildPlaceWhereConditions = (params: SearchPlaceFilterParamsInput) => [
    between(
        place.dateTime,
        toJstISOString(params.startDate),
        toJstISOString(params.finishDate),
    ),
    hasFilterValues(params.raceTypeList)
        ? inArray(place.raceType, params.raceTypeList)
        : undefined,
    hasFilterValues(params.locationList)
        ? inArray(place.locationCode, params.locationList)
        : undefined,
    hasFilterValues(params.gradeList)
        ? inArray(placeGrade.placeGrade, params.gradeList)
        : undefined,
];

/**
 * PlaceEntity を place テーブルへの INSERT 行に変換する。
 * @param entity - 変換対象のエンティティ
 */
const toPlaceInsertRow = (entity: PlaceEntity) => ({
    placeId: entity.placeId,
    raceType: entity.raceType,
    dateTime:
        typeof entity.datetime === 'string'
            ? entity.datetime
            : toJstISOString(entity.datetime),
    locationCode: entity.locationCode,
    isRaceListAvailable:
        entity.isRaceListAvailable === undefined
            ? null
            : entity.isRaceListAvailable
              ? 1
              : 0,
});

/** mapPlaceRowToEntity の戻り値。マッピング成功時は entity のみ、失敗時は warning のみ埋まる。 */
interface MapPlaceRowResult {
    entity: PlaceEntity | null;
    warning?: string;
}

/**
 * fetch の1行を PlaceEntity に変換する。マッピング失敗時はログを出して null を返す
 * （不正な1行のためにリクエスト全体を失敗させない。RaceRepository.mapRaceRowSafely と同じ方針）。
 * 失敗時のメッセージは warning として返し、呼び出し元が data_quality_warning_log への
 * 記録に使う。
 * @param row - Drizzle が返した生の place 行
 * @param isGradeTarget - placeGrade を Entity に含めるか
 */
const mapPlaceRowToEntity = (
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- Drizzleから返る生DB行を検証しながら変換する境界の中間表現のため、Record<string, unknown>が正しい
    row: Record<string, unknown>,
    isGradeTarget: boolean,
): MapPlaceRowResult => {
    try {
        return {
            entity: PlaceMapper.toEntity(row, {
                includePlaceGrade: isGradeTarget,
            }),
        };
    } catch (error) {
        const message = createErrorMessage('PlaceRepository', error);
        const warning = `Skipping invalid place row ${JSON.stringify(row)}: ${message}`;
        appLogger.warn(`[PlaceRepository.fetch] ${warning}`);
        return { entity: null, warning };
    }
};

/**
 * PlaceRepositoryのDB実装
 * @remarks
 * Repository層はgatewayからのデータを検証し、
 * 正しい型のEntityだけをusecaseに返す
 */
@LogAllMethods
@injectable()
export class PlaceRepository implements IPlaceRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    /**
     * place テーブルへの INSERT（UPSERT）クエリを組み立てる（未実行）。
     * @param entities
     * @remarks
     * ON CONFLICT の対象は place_id ではなく (race_type, date_time, location_code)
     * の複合ビジネスキーにする（Issue #2505）。place_id はこの3値から
     * composePlaceId で導出される値であり、旧フォーマットの place_id を持つ
     * 既存行がある場合、place_id を対象にすると「複合UNIQUE制約には違反するが
     * PKは一致しない」行を吸収できず SQLITE_CONSTRAINT_UNIQUE で失敗していた。
     * 複合キーを対象にすることで、place_id 側も excluded の値へ書き換えて
     * 自己修復させる。
     */
    private buildPlaceInsertQuery(entities: PlaceEntity[]) {
        return this.drizzleGateway.db
            .insert(place)
            .values(entities.map((entity) => toPlaceInsertRow(entity)))
            .onConflictDoUpdate({
                target: [place.raceType, place.dateTime, place.locationCode],
                set: {
                    placeId: sql`excluded.place_id`,
                    isRaceListAvailable: sql`excluded.is_race_list_available`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }

    /**
     * place_held_day テーブルへの INSERT（UPSERT）クエリを組み立てる（未実行）。
     * 対象が0件の場合は undefined を返す。
     * @param entities
     */
    private buildPlaceHeldDayInsertQuery(entities: PlaceEntity[]) {
        // placeHeldDays をもつもののみ抽出
        const heldDayEntities = entities.filter(
            (entity) => entity.placeHeldDays,
        );
        if (heldDayEntities.length === 0) return;
        return this.drizzleGateway.db
            .insert(placeHeldDay)
            .values(
                heldDayEntities.map((entity) => ({
                    placeId: entity.placeId,
                    heldTimes: entity.placeHeldDays?.heldTimes ?? 0,
                    heldDayTimes: entity.placeHeldDays?.heldDayTimes ?? 0,
                })),
            )
            .onConflictDoUpdate({
                target: placeHeldDay.placeId,
                set: {
                    heldTimes: sql`excluded.held_times`,
                    heldDayTimes: sql`excluded.held_day_times`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }

    /**
     * place_grade テーブルへの INSERT（機械式のみ・UPSERT）クエリを組み立てる（未実行）。
     * 対象が0件の場合は undefined を返す。
     * @param entities
     */
    private buildPlaceGradeInsertQuery(entities: PlaceEntity[]) {
        // 機械式かつ placeGrade をもつもののみ抽出
        const gradeEntities = entities.filter(
            (entity) =>
                entity.placeGrade !== undefined &&
                isMechanicalRace(entity.raceType),
        );
        if (gradeEntities.length === 0) return;
        return this.drizzleGateway.db
            .insert(placeGrade)
            .values(
                gradeEntities.map((entity) => ({
                    placeId: entity.placeId,
                    // gradeEntities は placeGrade !== undefined でフィルタ済み
                    placeGrade: entity.placeGrade ?? '',
                })),
            )
            .onConflictDoUpdate({
                target: placeGrade.placeId,
                set: {
                    placeGrade: sql`excluded.place_grade`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }

    /**
     * place/place_held_day/place_grade への INSERT を1つの D1 バッチにまとめて実行する。
     * @remarks
     * CONC-06: raceRepositoryのCONC-05対応と同様、3テーブルへの INSERT を
     * `db.batch()` でまとめることで部分コミット状態を防ぐ。
     * @param entities - 対象のエンティティ一覧（chunk）
     */
    private async batchInsertPlaceTables(
        entities: PlaceEntity[],
    ): Promise<void> {
        const queries = [
            this.buildPlaceInsertQuery(entities),
            this.buildPlaceHeldDayInsertQuery(entities),
            this.buildPlaceGradeInsertQuery(entities),
        ].filter((query): query is NonNullable<typeof query> => Boolean(query));
        // buildPlaceInsertQuery は entities（chunk）が非空である前提で常に定義済みの
        // クエリを返すため、queries は必ず1件以上になる（db.batch()が要求する非空タプル）。
        await this.drizzleGateway.db.batch(
            queries as [
                (typeof queries)[number],
                ...(typeof queries)[number][],
            ],
        );
    }

    /**
     * 無効な place_grade レコードを削除（非機械式）
     * @param entities
     */
    private async cleanupInvalidGrades(entities: PlaceEntity[]): Promise<void> {
        // 非機械式の place_id からグレード情報を削除
        const nonMechanicalIds = entities
            .filter((entity) => !isMechanicalRace(entity.raceType))
            .map((entity) => entity.placeId);
        if (nonMechanicalIds.length === 0) return;
        try {
            await this.drizzleGateway.db
                .delete(placeGrade)
                .where(inArray(placeGrade.placeId, nonMechanicalIds));
        } catch (error) {
            appLogger.warn(
                'failed to delete place_grade for non-mechanical types',
                error,
            );
        }
    }

    public async fetch(
        params: SearchPlaceFilterParamsInput,
    ): Promise<PlaceEntity[]> {
        // place_grade / place_held_day は常に LEFT JOIN する。
        // placeGrade をEntityへ含めるかどうかは isGradeTarget を options として
        // PlaceMapper へ渡し、Mapper 側の判定に委ねる（SQL構造とは独立させる）。
        const isGradeTarget = isPlaceGradeJoinNeeded(
            params.raceTypeList,
            params.gradeList,
        );

        const rows = await this.drizzleGateway.db
            .select({
                placeId: place.placeId,
                raceType: place.raceType,
                dateTime: place.dateTime,
                locationCode: place.locationCode,
                isRaceListAvailable: place.isRaceListAvailable,
                placeGrade: placeGrade.placeGrade,
                heldTimes: placeHeldDay.heldTimes,
                heldDayTimes: placeHeldDay.heldDayTimes,
            })
            .from(place)
            .leftJoin(placeGrade, eq(placeGrade.placeId, place.placeId))
            .leftJoin(placeHeldDay, eq(placeHeldDay.placeId, place.placeId))
            .where(and(...buildPlaceWhereConditions(params)))
            .limit(FETCH_ROW_LIMIT);

        appLogger.info(
            `[PlaceRepository.fetch] SQL results count: ${rows.length}`,
        );

        return this.mapRowsAndRecordWarnings(rows, isGradeTarget);
    }

    /**
     * Gateway からの生行を検証しながら PlaceEntity に変換する。マッピング失敗行は
     * data_quality_warning_log へベストエフォートで記録し、結果からは除外する。
     * @param rows - Drizzle が返した生の place 行一覧
     * @param isGradeTarget - placeGrade を Entity に含めるか
     */
    private async mapRowsAndRecordWarnings(
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- mapPlaceRowToEntityと同じ、検証前の生DB行一覧
        rows: Record<string, unknown>[],
        isGradeTarget: boolean,
    ): Promise<PlaceEntity[]> {
        const mapped = rows.map((row) =>
            mapPlaceRowToEntity(row, isGradeTarget),
        );
        const warnings = mapped
            .map((result) => result.warning)
            .filter((warning): warning is string => warning !== undefined);
        await recordDataQualityWarning(
            this.drizzleGateway.db,
            'place_mapper',
            warnings,
        );

        return mapped
            .map((result) => result.entity)
            .filter((entity): entity is PlaceEntity => entity !== null);
    }

    public async upsert(entityList: PlaceEntity[]): Promise<UpsertResult> {
        // entityListの型（PlaceEntity[]）はdomain層で検証済みのため、ここではビジネスロジックに集中
        const result = createEmptyUpsertResult();
        if (entityList.length === 0) return result;

        // バッチ処理: チャンク単位でデータを処理（D1のSQLバインド変数上限対応）
        const chunkSize = PLACE_UPSERT_CHUNK_SIZE;
        await processInChunks(
            entityList,
            chunkSize,
            async (chunk) => {
                // place/place_held_day/place_grade への INSERT を1つのD1バッチにまとめる（CONC-06）
                await this.batchInsertPlaceTables(chunk);
                // 削除対象のレコードを処理（非機械式）
                await this.cleanupInvalidGrades(chunk);
                // 成功数をカウント
                recordUpsertChunkSuccess(result, chunk);
            },
            (chunk, error) =>
                recordUpsertChunkFailure(result, chunk, error, {
                    db: 'place',
                    source: 'PlaceRepository',
                    idOf: (entity) => entity.placeId,
                }),
        );
        return result;
    }
}
