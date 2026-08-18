import type {
    RaceEntity,
    RaceId,
    RacePlayerEntity,
    SearchRaceFilterParamsInput,
} from '@race-schedule/core';
import {
    appLogger,
    createEmptyUpsertResult,
    createJstDate,
    DI_TOKENS,
    generateRacePlayerId,
    getJstDate,
    getJstMonth,
    getJstYear,
    isHorseRace,
    isMechanicalRace,
    LogAllMethods,
    RaceType,
    type UpsertResult,
    validateRacePlayerEntity,
} from '@race-schedule/core';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import {
    placeGrade,
    placeHeldDay,
    playerAutorace,
    playerKeirin,
    playerWatch,
    race,
    raceCondition,
    racePlayer,
    raceStage,
} from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type { IRaceRepository } from '../interface/IRaceRepository';
import { chunkArray } from '../utility/chunkArray';
import { upsertPlayerFacts } from '../utility/playerFactSqlHelpers';
import { processInChunks } from '../utility/processInChunks';
import {
    FETCH_ROW_LIMIT,
    hasFilterValues,
} from '../utility/queryFilterHelpers';
import {
    buildRaceStageConfirmedCondition,
    buildRaceWhereConditions,
    resolveRaceJoinTargets,
    selectRaceColumns,
    toRaceInsertRow,
} from '../utility/raceSqlHelpers';
import { pruneStaleRacePlayers } from '../utility/staleRacePlayerPruner';
import { pruneStaleRaces } from '../utility/staleRacePruner';
import {
    D1_MAX_BIND_VARS,
    resolveUpsertChunkSize,
} from '../utility/upsertChunk';
import {
    recordUpsertChunkFailure,
    recordUpsertChunkSuccess,
} from '../utility/upsertResultAggregator';
import { RaceMapper } from './raceMapper';

/**
 * race_player テーブル 1 行あたりのバインド変数数
 * （race_player_id, race_id, race_type, car_number, frame_number, player_no, player_name）
 */
const RACE_PLAYER_INSERT_PARAMS_PER_ROW = 7;

/**
 * race_player upsert のチャンクサイズ（floor(100 / 7) = 14）。
 * @remarks
 * 1レースチャンク（RACE_UPSERT_CHUNK_SIZE=11レース）あたり最大9選手が
 * ぶら下がりうる（最大99行）ため、race レベルのチャンクサイズとは別に、
 * race_player 自身の行数でも安全なチャンクへ再分割する。
 */
const RACE_PLAYER_UPSERT_CHUNK_SIZE = resolveUpsertChunkSize(
    RACE_PLAYER_INSERT_PARAMS_PER_ROW,
);

/** player_keirin テーブル 1 行あたりのバインド変数数（player_no, term, branch） */
const PLAYER_KEIRIN_INSERT_PARAMS_PER_ROW = 3;

/** player_keirin upsert のチャンクサイズ（floor(100 / 3) = 33） */
const PLAYER_KEIRIN_UPSERT_CHUNK_SIZE = resolveUpsertChunkSize(
    PLAYER_KEIRIN_INSERT_PARAMS_PER_ROW,
);

/** player_autorace テーブル 1 行あたりのバインド変数数（player_no, branch） */
const PLAYER_AUTORACE_INSERT_PARAMS_PER_ROW = 2;

/** player_autorace upsert のチャンクサイズ（floor(100 / 2) = 50） */
const PLAYER_AUTORACE_UPSERT_CHUNK_SIZE = resolveUpsertChunkSize(
    PLAYER_AUTORACE_INSERT_PARAMS_PER_ROW,
);

/**
 * fetchWatchedRaceIds の IN 句チャンクサイズ。
 * @remarks
 * raceId 1件につき IN 句のバインド変数1件 + `priority > 0` の固定パラメータ1件を
 * 消費するため、D1_MAX_BIND_VARS から固定分の1件を差し引く。raceTypeList に
 * NAR/KEIRIN 等を広い日付レンジで指定すると raceIds が100件を超えうるため、
 * このチャンク分割が無いと D1 のバインド変数上限超過で /race 全体が500になる
 * （Issue #2350 の nar-calendar/keirin-calendar 500エラーの原因）。
 */
const WATCHED_RACE_IDS_CHUNK_SIZE = D1_MAX_BIND_VARS - 1;

/**
 * RaceEntity.playerList から集約した、出走選手1名分の観測事実。
 * term は KEIRIN のみが持つため任意。branch は KEIRIN/AUTORACE 双方が持ちうるが、
 * 意味は競技により異なる（KEIRIN=府県、AUTORACE=拠点/LG）ため任意。
 */
interface CollectedPlayer {
    raceType: string;
    playerNo: string;
    playerName: string;
    term?: number;
    branch?: string;
}

/**
 * race テーブル 1 行あたりのバインド変数数
 * （toRaceInsertRow の columns 数。バッチ内で最も列数が多く、上限を決める:
 * raceId, placeId, raceType, raceName, dateTime, locationCode, grade,
 * raceNumber, isConfirmed の9列）
 * @remarks
 * Issue #2484: PR #2483（未確定バッジ機能）で `toRaceInsertRow` に
 * `isConfirmed` 列が追加されたが、この定数が8のまま更新されていなかった。
 * 実際の列数（9）より少ない値でチャンクサイズを算出していたため、
 * 1チャンクあたりの実バインド数が 12行×9列=108 個となりD1の上限(100)を
 * 超過し、`race` upsert が nar/keirin/autorace で軒並み失敗していた
 * （playerFactSqlHelpers.ts の PLAYER_FACT_PARAMS_PER_ROW と同種の
 * 「列追加時に数え忘れる」バグ）。
 */
const RACE_INSERT_PARAMS_PER_ROW = 9;

/**
 * upsert のチャンクサイズ
 * （D1 のバインド変数上限を 1 行あたりの変数数で割った値: floor(100 / 9) = 11）
 */
const RACE_UPSERT_CHUNK_SIZE = resolveUpsertChunkSize(
    RACE_INSERT_PARAMS_PER_ROW,
);

/**
 * race_player.branch の算出列（player_keirin/player_autoraceの両方をLEFT JOINし、
 * どちらか一方にある値をCOALESCEで補う）。
 */
const RACE_PLAYER_BRANCH_COLUMN = sql<
    string | null
>`COALESCE(${playerKeirin.branch}, ${playerAutorace.branch})`;

/**
 * RaceRepositoryのDB実装
 * @remarks
 * Repository層はgatewayからのデータを検証し、
 * 正しい型のEntityだけをusecaseに返す
 */
@LogAllMethods
@injectable()
export class RaceRepository implements IRaceRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    /**
     * race テーブルへの INSERT（UPSERT）クエリを組み立てる（未実行）。
     * @param entities
     */
    private buildRaceInsertQuery(entities: RaceEntity[]) {
        return this.drizzleGateway.db
            .insert(race)
            .values(entities.map((entity) => toRaceInsertRow(entity)))
            .onConflictDoUpdate({
                target: race.raceId,
                set: {
                    placeId: sql`excluded.place_id`,
                    raceType: sql`excluded.race_type`,
                    raceName: sql`excluded.race_name`,
                    dateTime: sql`excluded.date_time`,
                    locationCode: sql`excluded.location_code`,
                    grade: sql`excluded.grade`,
                    raceNumber: sql`excluded.race_number`,
                    isConfirmed: sql`excluded.is_confirmed`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }

    /**
     * race_stage テーブルへの INSERT（機械式競技のみ・UPSERT）クエリを組み立てる（未実行）。
     * 対象が0件の場合は undefined を返す。
     * @param entities
     */
    private buildRaceStageInsertQuery(entities: RaceEntity[]) {
        // 機械式かつ raceStage を持つもののみ抽出
        const stageEntities = entities.filter(
            (entity) => isMechanicalRace(entity.raceType) && entity.raceStage,
        );
        if (stageEntities.length === 0) return;
        return this.drizzleGateway.db
            .insert(raceStage)
            .values(
                stageEntities.map((entity) => ({
                    raceId: entity.raceId,
                    // stageEntities は raceStage が truthy のものだけにフィルタ済み
                    raceStage: entity.raceStage ?? '',
                    // マスタ（stageByWebSite）未一致の原文ママ仮登録は0、それ以外は1
                    isConfirmed: entity.raceStageConfirmed === false ? 0 : 1,
                })),
            )
            .onConflictDoUpdate({
                target: raceStage.raceId,
                set: {
                    raceStage: sql`excluded.race_stage`,
                    isConfirmed: sql`excluded.is_confirmed`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }

    /**
     * race_condition テーブルへの INSERT（競馬種別のみ・UPSERT）クエリを組み立てる（未実行）。
     * 対象が0件の場合は undefined を返す。
     * @param entities
     */
    private buildRaceConditionInsertQuery(entities: RaceEntity[]) {
        // 競馬種別かつ conditionData を持つもののみ抽出
        const conditionEntities = entities.filter(
            (entity) => isHorseRace(entity.raceType) && entity.conditionData,
        );
        if (conditionEntities.length === 0) return;
        return this.drizzleGateway.db
            .insert(raceCondition)
            .values(
                conditionEntities.map((entity) => ({
                    raceId: entity.raceId,
                    // conditionEntities は conditionData ありでフィルタ済み
                    distance: entity.conditionData?.distance ?? 0,
                    surfaceType: entity.conditionData?.surfaceType ?? '',
                })),
            )
            .onConflictDoUpdate({
                target: raceCondition.raceId,
                set: {
                    distance: sql`excluded.distance`,
                    surfaceType: sql`excluded.surface_type`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }

    /**
     * race/race_stage/race_condition への INSERT を1つの D1 バッチにまとめて実行する。
     * @remarks
     * CONC-05: 従来は3テーブルへの INSERT を個別に逐次 await しており、
     * 途中（例: race_stage）で失敗すると race テーブルだけ更新された部分コミット状態が
     * 残り得た。`db.batch()` でまとめることで、1つでも失敗すれば全体がロールバックされる
     * （CONC-08の `removeWithDependentRequests` と同じ考え方）。
     * @param entities - 対象のエンティティ一覧（chunk）
     */
    private async batchInsertRaceTables(entities: RaceEntity[]): Promise<void> {
        const queries = [
            this.buildRaceInsertQuery(entities),
            this.buildRaceStageInsertQuery(entities),
            this.buildRaceConditionInsertQuery(entities),
        ].filter((query): query is NonNullable<typeof query> => Boolean(query));
        // buildRaceInsertQuery は entities（chunk）が非空である前提で常に定義済みの
        // クエリを返すため、queries は必ず1件以上になる（db.batch()が要求する非空タプル）。
        await this.drizzleGateway.db.batch(
            queries as [
                (typeof queries)[number],
                ...(typeof queries)[number][],
            ],
        );
    }

    /**
     * RaceEntity.playerList から選手コード単位で重複排除した観測事実一覧を組み立てる。
     * @remarks
     * 同一チャンク内の複数レースに同じ選手が出走する場合があるため、
     * player_no で重複排除してから player / player_keirin へ書き込む
     * （keirin-player-data-design.md §4.8）。
     * @param entities
     */
    private collectDistinctPlayers(entities: RaceEntity[]): CollectedPlayer[] {
        const byPlayerNo = new Map<string, CollectedPlayer>();
        for (const entity of entities) {
            if (!entity.playerList) continue;
            for (const racePlayerEntity of entity.playerList) {
                byPlayerNo.set(racePlayerEntity.playerNo, {
                    raceType: entity.raceType,
                    playerNo: racePlayerEntity.playerNo,
                    playerName: racePlayerEntity.playerName,
                    term: racePlayerEntity.term,
                    branch: racePlayerEntity.branch,
                });
            }
        }
        return [...byPlayerNo.values()];
    }

    /**
     * playerList を持つエンティティから、player テーブル（観測事実のみ）への
     * バッチ INSERT（UPSERT）を行う。priority（player_watch側の責務）へは触れない。
     * @param entities
     */
    private async batchUpsertPlayerFacts(
        entities: RaceEntity[],
    ): Promise<void> {
        const distinctPlayers = this.collectDistinctPlayers(entities);
        await upsertPlayerFacts(this.drizzleGateway.db, distinctPlayers);
    }

    /**
     * player_keirin テーブル（期別・府県）へのバッチ INSERT（UPSERT）。
     * term/branch のいずれかが未取得の選手は対象外とする。
     * @param entities
     */
    private async batchInsertPlayerKeirin(
        entities: RaceEntity[],
    ): Promise<void> {
        const rows = this.collectDistinctPlayers(entities)
            .filter(
                (p): p is CollectedPlayer & { term: number; branch: string } =>
                    p.term !== undefined && p.branch !== undefined,
            )
            .map((p) => ({
                playerNo: p.playerNo,
                term: p.term,
                branch: p.branch,
            }));
        if (rows.length === 0) return;
        for (const chunk of chunkArray(rows, PLAYER_KEIRIN_UPSERT_CHUNK_SIZE)) {
            await this.drizzleGateway.db
                .insert(playerKeirin)
                .values(chunk)
                .onConflictDoUpdate({
                    target: playerKeirin.playerNo,
                    set: {
                        term: sql`excluded.term`,
                        branch: sql`excluded.branch`,
                        updatedAt: sql`CURRENT_TIMESTAMP`,
                    },
                });
        }
    }

    /**
     * player_autorace テーブル（拠点/LG）へのバッチ INSERT（UPSERT）。
     * AUTORACE以外は対象外とする（branchはKEIRINも持つため、raceTypeで
     * 明示的に絞り込まないとKEIRIN選手がplayer_autoraceへ誤って書き込まれる）。
     * @param entities
     */
    private async batchInsertPlayerAutorace(
        entities: RaceEntity[],
    ): Promise<void> {
        const rows = this.collectDistinctPlayers(entities)
            .filter(
                (p): p is CollectedPlayer & { branch: string } =>
                    p.raceType === RaceType.AUTORACE && p.branch !== undefined,
            )
            .map((p) => ({
                playerNo: p.playerNo,
                branch: p.branch,
            }));
        if (rows.length === 0) return;
        for (const chunk of chunkArray(
            rows,
            PLAYER_AUTORACE_UPSERT_CHUNK_SIZE,
        )) {
            await this.drizzleGateway.db
                .insert(playerAutorace)
                .values(chunk)
                .onConflictDoUpdate({
                    target: playerAutorace.playerNo,
                    set: {
                        branch: sql`excluded.branch`,
                        updatedAt: sql`CURRENT_TIMESTAMP`,
                    },
                });
        }
    }

    /**
     * race_player テーブル（出走表のスナップショット）へのバッチ INSERT（UPSERT）。
     * race_player_id は raceId + carNumber(2桁) の合成ID（generateRacePlayerId）。
     * @param entities
     */
    private async batchInsertRacePlayer(entities: RaceEntity[]): Promise<void> {
        const rows = entities.flatMap((entity) =>
            (entity.playerList ?? []).map((racePlayerEntity) => ({
                racePlayerId: generateRacePlayerId(
                    entity.raceId,
                    racePlayerEntity.carNumber,
                ),
                raceId: entity.raceId,
                raceType: entity.raceType,
                carNumber: racePlayerEntity.carNumber,
                frameNumber: racePlayerEntity.frameNumber,
                playerNo: racePlayerEntity.playerNo,
                playerName: racePlayerEntity.playerName,
            })),
        );
        if (rows.length === 0) return;
        for (const chunk of chunkArray(rows, RACE_PLAYER_UPSERT_CHUNK_SIZE)) {
            await this.drizzleGateway.db
                .insert(racePlayer)
                .values(chunk)
                .onConflictDoUpdate({
                    target: racePlayer.racePlayerId,
                    set: {
                        frameNumber: sql`excluded.frame_number`,
                        playerNo: sql`excluded.player_no`,
                        playerName: sql`excluded.player_name`,
                        updatedAt: sql`CURRENT_TIMESTAMP`,
                    },
                });
        }
    }

    /**
     * 非機械式の race_id から race_player 情報を削除する。
     * @param entities
     */
    private async deleteRacePlayerForNonMechanical(
        entities: RaceEntity[],
    ): Promise<void> {
        const nonMechanicalIds = entities
            .filter((entity) => !isMechanicalRace(entity.raceType))
            .map((entity) => entity.raceId);
        if (nonMechanicalIds.length === 0) return;
        try {
            await this.drizzleGateway.db
                .delete(racePlayer)
                .where(inArray(racePlayer.raceId, nonMechanicalIds));
        } catch (error) {
            appLogger.warn(
                'failed to delete race_player for non-mechanical types',
                error,
            );
        }
    }

    /**
     * 非機械式の race_id から race_stage 情報を削除する。
     * @param entities
     */
    private async deleteRaceStageForNonMechanical(
        entities: RaceEntity[],
    ): Promise<void> {
        const nonMechanicalIds = entities
            .filter((entity) => !isMechanicalRace(entity.raceType))
            .map((entity) => entity.raceId);
        if (nonMechanicalIds.length === 0) return;
        try {
            await this.drizzleGateway.db
                .delete(raceStage)
                .where(inArray(raceStage.raceId, nonMechanicalIds));
        } catch (error) {
            appLogger.warn(
                'failed to delete race_stage for non-mechanical types',
                error,
            );
        }
    }

    /**
     * 非競馬種別の race_id から race_condition 情報を削除する。
     * @param entities
     */
    private async deleteRaceConditionForNonHorse(
        entities: RaceEntity[],
    ): Promise<void> {
        const nonHorseIds = entities
            .filter((entity) => !isHorseRace(entity.raceType))
            .map((entity) => entity.raceId);
        if (nonHorseIds.length === 0) return;
        try {
            await this.drizzleGateway.db
                .delete(raceCondition)
                .where(inArray(raceCondition.raceId, nonHorseIds));
        } catch (error) {
            appLogger.warn(
                'failed to delete race_condition for non-horse types',
                error,
            );
        }
    }

    /**
     * 無効な関連レコードを削除（非機械式と非競馬種別）
     * @param entities
     */
    private async cleanupInvalidRelations(
        entities: RaceEntity[],
    ): Promise<void> {
        await this.deleteRaceStageForNonMechanical(entities);
        await this.deleteRaceConditionForNonHorse(entities);
        await this.deleteRacePlayerForNonMechanical(entities);
    }

    /**
     * DB行をRaceEntityへ変換する。バリデーションエラー時はwarnログを出しnullを返す。
     * @remarks
     * fetch / fetchByRaceId で重複していた
     * 「RaceMapper.toEntity → catch → warn ログ → null 返却」を集約する。
     * @param row - DB から返された生の行データ
     * @param methodName - 呼び出し元メソッド名（ログ出力用）
     */
    private mapRaceRowSafely(
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- Drizzleから返る生DB行をRaceMapperで検証する前の中間表現のため、Record<string, unknown>が正しい
        row: Record<string, unknown>,
        methodName: 'fetch' | 'fetchByRaceId',
    ): RaceEntity | null {
        try {
            return RaceMapper.toEntity(row);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unknown error';
            appLogger.warn(
                `[RaceRepository.${methodName}] Skipping invalid race row: ${message}`,
            );
            return null;
        }
    }

    /**
     * 1チャンク分の race/race_stage/race_condition 登録と無効関連削除を行い、
     * result・succeededEntities に反映する。
     * @param chunk - 処理対象のチャンク
     * @param result - 集計結果（ミューテートして返す）
     * @param succeededEntities - 成功したエンティティの蓄積先（ミューテートして返す）
     */
    private async processRaceChunk(
        chunk: RaceEntity[],
        result: UpsertResult,
        succeededEntities: RaceEntity[],
    ): Promise<void> {
        // race/race_stage/race_condition への INSERT を1つのD1バッチにまとめる（CONC-05）
        await this.batchInsertRaceTables(chunk);
        // player / player_keirin / player_autorace テーブルのバッチ INSERT
        // （playerListを持つ種別のみ）
        await this.batchUpsertPlayerFacts(chunk);
        await this.batchInsertPlayerKeirin(chunk);
        await this.batchInsertPlayerAutorace(chunk);
        // race_player テーブルのバッチ INSERT（出走表のスナップショット）
        await this.batchInsertRacePlayer(chunk);
        // 削除対象の ID を除去（非機械式と非競馬種別）
        await this.cleanupInvalidRelations(chunk);
        // 成功数をカウント
        recordUpsertChunkSuccess(result, chunk);
        succeededEntities.push(...chunk);
    }

    /**
     * fetch 用の SELECT クエリを組み立てる。
     * @remarks
     * PERF-043: raceTypeList が特定の種別に絞られている場合、その種別に無関係な
     * race_condition/race_stage の JOIN を `joinTargets` に応じて動的に省略する
     * （`$dynamic()` で条件付き `.leftJoin()` を可能にする）。
     * @param params - 検索フィルタパラメータ
     * @param adjustedFinishDate - JST日付の最後（23:59:59）に調整済みの finishDate
     * @param joinTargets - race_condition / race_stage を JOIN するか
     * @returns 実行前のクエリビルダ
     */
    private buildFetchQuery(
        params: SearchRaceFilterParamsInput,
        adjustedFinishDate: Date,
        joinTargets: ReturnType<typeof resolveRaceJoinTargets>,
    ) {
        let query = this.drizzleGateway.db
            .select(selectRaceColumns(joinTargets))
            .from(race)
            .leftJoin(placeGrade, eq(placeGrade.placeId, race.placeId))
            .leftJoin(placeHeldDay, eq(placeHeldDay.placeId, race.placeId))
            .$dynamic();

        if (joinTargets.includeRaceStage) {
            query = query.leftJoin(
                raceStage,
                eq(raceStage.raceId, race.raceId),
            );
        }
        if (joinTargets.includeRaceCondition) {
            query = query.leftJoin(
                raceCondition,
                eq(raceCondition.raceId, race.raceId),
            );
        }

        return query.where(
            and(
                ...buildRaceWhereConditions(
                    params,
                    adjustedFinishDate,
                    joinTargets.includeRaceCondition,
                    joinTargets.includeRaceStage,
                ),
            ),
        );
    }

    public async fetch(
        params: SearchRaceFilterParamsInput,
    ): Promise<RaceEntity[]> {
        // finishDate をJSTの日付の最後（23:59:59）に調整
        // `setHours` は実行環境のローカルタイムゾーン基準で日付境界を判定するため、
        // UTCで動くWorker/CI環境ではJSTの日付境界とズレる。
        // JSTの年月日を明示的に取り出して created することでタイムゾーン非依存にする。
        const adjustedFinishDate = createJstDate(
            getJstYear(params.finishDate),
            getJstMonth(params.finishDate),
            getJstDate(params.finishDate),
            23,
            59,
            59,
        );
        const joinTargets = resolveRaceJoinTargets(params.raceTypeList);

        const rows = await this.buildFetchQuery(
            params,
            adjustedFinishDate,
            joinTargets,
        )
            .orderBy(asc(race.dateTime))
            .limit(FETCH_ROW_LIMIT);

        // Gateway からのデータを検証しながら Entity に変換
        // バリデーションエラーが発生した行（例: race_stage が未登録の旧KEIRINデータ）は
        // スキップして警告のみ出す。shouldIncludeInCalendar が stage なしを除外するため安全。
        return rows
            .map((row) => this.mapRaceRowSafely(row, 'fetch'))
            .filter((entity): entity is RaceEntity => entity !== null);
    }

    /**
     * raceIdを指定して単一のレース情報を取得する
     * @remarks
     * raceType が不明な単発取得のため、date/種別による絞り込みは行わず race_id のみで検索する。
     * raceType が確定していないため JOIN 対象は絞り込めず、常に全テーブルを JOIN する
     * （PERF-043の対象外）。
     * @param raceId - 取得対象のraceId（domain検証済みのRaceId型）
     */
    public async fetchByRaceId(raceId: RaceId): Promise<RaceEntity | null> {
        const rows = await this.drizzleGateway.db
            .select(
                selectRaceColumns({
                    includeRaceCondition: true,
                    includeRaceStage: true,
                }),
            )
            .from(race)
            .leftJoin(placeGrade, eq(placeGrade.placeId, race.placeId))
            .leftJoin(raceStage, eq(raceStage.raceId, race.raceId))
            .leftJoin(raceCondition, eq(raceCondition.raceId, race.raceId))
            .leftJoin(placeHeldDay, eq(placeHeldDay.placeId, race.placeId))
            .where(
                and(
                    eq(race.raceId, raceId),
                    buildRaceStageConfirmedCondition(),
                ),
            );

        if (rows.length === 0) {
            return null;
        }

        return this.mapRaceRowSafely(rows[0], 'fetchByRaceId');
    }

    /**
     * fetchWatchedRaceIds の1チャンク分（raceId最大 WATCHED_RACE_IDS_CHUNK_SIZE件）を取得する。
     * @param raceIdChunk - 絞り込み対象の raceId チャンク
     */
    private async fetchWatchedRaceIdsChunk(
        raceIdChunk: string[],
    ): Promise<{ raceId: string }[]> {
        return this.drizzleGateway.db
            .selectDistinct({ raceId: racePlayer.raceId })
            .from(racePlayer)
            .innerJoin(
                playerWatch,
                and(
                    eq(playerWatch.raceType, racePlayer.raceType),
                    eq(playerWatch.playerNo, racePlayer.playerNo),
                ),
            )
            .where(
                and(
                    inArray(racePlayer.raceId, raceIdChunk),
                    sql`${playerWatch.priority} > 0`,
                ),
            );
    }

    /**
     * 指定した raceId のうち、注目選手（player_watch, priority>0）が
     * 出走しているものの集合を取得する（SPEC-PLAYER-001）。
     * D1のバインド変数上限（100件）を超えないよう、raceIdsをチャンク分割して
     * 並列にクエリする（Issue #2350）。
     * @param raceIds - 絞り込み対象の raceId 一覧
     * @returns 指定raceIdのうち注目選手が出走しているものの集合
     */
    public async fetchWatchedRaceIds(
        raceIds: readonly string[],
    ): Promise<Set<string>> {
        if (!hasFilterValues(raceIds)) return new Set();

        const chunks = chunkArray([...raceIds], WATCHED_RACE_IDS_CHUNK_SIZE);
        const chunkResults = await Promise.all(
            chunks.map((chunk) => this.fetchWatchedRaceIdsChunk(chunk)),
        );
        return new Set(chunkResults.flat().map((row) => row.raceId));
    }

    /**
     * raceIdを指定して、そのレースの出走選手一覧（race_playerのスナップショット）を
     * 車番昇順で取得する。player_keirin（期別・府県）・player_autorace（拠点/LG）を
     * LEFT JOINで補うが、まだ紐付いていない場合はterm/branchを省略した値を返す。
     * branchはKEIRIN/AUTORACEのいずれか一方にしか行が無い前提でCOALESCEする
     * （player_noは競技ごとに独立した採番のため、通常は両方に一致行が生じない）。
     * @param raceId - 取得対象のraceId
     * @returns 出走選手一覧。race_playerに行が無い場合（機械式以外・未取得）は空配列
     */
    public async fetchRacePlayers(raceId: RaceId): Promise<RacePlayerEntity[]> {
        const rows = await this.drizzleGateway.db
            .select({
                carNumber: racePlayer.carNumber,
                frameNumber: racePlayer.frameNumber,
                playerNo: racePlayer.playerNo,
                playerName: racePlayer.playerName,
                term: playerKeirin.term,
                branch: RACE_PLAYER_BRANCH_COLUMN,
            })
            .from(racePlayer)
            .leftJoin(
                playerKeirin,
                eq(playerKeirin.playerNo, racePlayer.playerNo),
            )
            .leftJoin(
                playerAutorace,
                eq(playerAutorace.playerNo, racePlayer.playerNo),
            )
            .where(eq(racePlayer.raceId, raceId))
            .orderBy(asc(racePlayer.carNumber));

        return rows.map((row) =>
            validateRacePlayerEntity({
                carNumber: row.carNumber,
                frameNumber: row.frameNumber,
                playerNo: row.playerNo,
                playerName: row.playerName,
                term: row.term ?? undefined,
                branch: row.branch ?? undefined,
            }),
        );
    }

    public async upsert(raceEntityList: RaceEntity[]): Promise<UpsertResult> {
        // raceEntityListの型（RaceEntity[]）はdomain層で検証済みのため、ここではビジネスロジックに集中
        const result = createEmptyUpsertResult();
        if (raceEntityList.length === 0) return result;

        // バッチ処理: チャンク単位でデータを処理（D1のSQLバインド変数上限対応）
        const succeededEntities: RaceEntity[] = [];
        const failedPlaceIds = new Set<string>();
        await processInChunks(
            raceEntityList,
            RACE_UPSERT_CHUNK_SIZE,
            (chunk) => this.processRaceChunk(chunk, result, succeededEntities),
            (chunk, error) =>
                recordUpsertChunkFailure(result, chunk, error, {
                    db: 'race',
                    source: 'RaceRepository',
                    idOf: (entity) => entity.raceId,
                    onEachFailure: (entity) =>
                        failedPlaceIds.add(entity.placeId),
                }),
        );

        // 今回のスクレイピング結果に含まれなくなった過去のレースを削除する
        // （開催が中止/レース数変更になった、暫定登録していたレースが実際には存在しなかった等）
        await pruneStaleRaces(
            this.drizzleGateway.db,
            succeededEntities,
            failedPlaceIds,
        );
        // 今回playerListを取得できたレースについて、出走表に含まれなくなった
        // race_player行（欠場等）を削除する
        await pruneStaleRacePlayers(this.drizzleGateway.db, succeededEntities);

        return result;
    }
}
