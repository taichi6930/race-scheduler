import {
    createEmptyUpsertResult,
    DI_TOKENS,
    getCurrentUserId,
    LogAllMethods,
    type PlayerEntity,
    type SearchPlayerFilterParamsInput,
    type UpsertResult,
} from '@race-schedule/core';
import { and, asc, eq, inArray, like, sql } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import {
    player,
    playerAutorace,
    playerKeirin,
    playerWatch,
} from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type { IPlayerRepository } from '../interface/IPlayerRepository';
import { upsertPlayerFacts } from '../utility/playerFactSqlHelpers';
import { processInChunks } from '../utility/processInChunks';
import { FETCH_ROW_LIMIT } from '../utility/queryFilterHelpers';
import { resolveUpsertChunkSize } from '../utility/upsertChunk';
import {
    recordUpsertChunkFailure,
    recordUpsertChunkSuccess,
} from '../utility/upsertResultAggregator';
import { PlayerMapper } from './playerMapper';

/**
 * player_watch テーブル 1 行あたりのバインド変数数（race_type, player_no, priority の3列）。
 * @remarks
 * entityList を outer チャンクへ分割する際のサイズ算出に使う。player テーブルへの書き込みは
 * batchInsertPlayer → upsertPlayerFacts が担い、そちらは player 側の実際のバインド数
 * （race_type, player_no, player_name, priority の4列）に基づく、自身の内部チャンクサイズで
 * 別途安全に再分割する（playerFactSqlHelpers.ts の PLAYER_FACT_PARAMS_PER_ROW）ため、
 * このouterチャンクサイズはplayer_watch側の3列だけを基準にすればよい。
 * PERF-056と同様、race/place/playerで確立した「複数テーブルを1つのチャンクサイズで
 * 揃える」流儀に合わせる。
 */
const PLAYER_INSERT_PARAMS_PER_ROW = 3;

/**
 * `player_watch`（段階2でuser単位化）を読み書きする際の呼び出し元ユーザーIDを取得する。
 * `POST/GET /player` はsession-onlyポリシーで保護されているため常に設定されている
 * はずだが、ミドルウェアの取りこぼしに備えフェイルクローズで例外を投げる
 * （SECURITY-15: userIdが無いまま他人のデータへ書き込む・読み込む事故を防ぐ）。
 */
const requireCurrentUserId = (): string => {
    const userId = getCurrentUserId();
    if (!userId) {
        throw new Error('player_watch操作にはセッション認証が必要です');
    }
    return userId;
};

/**
 * upsert のチャンクサイズ
 * （D1 のバインド変数上限を 1 行あたりの変数数で割った値: floor(100 / 3) = 33）
 */
const PLAYER_UPSERT_CHUNK_SIZE = resolveUpsertChunkSize(
    PLAYER_INSERT_PARAMS_PER_ROW,
);

/**
 * player.branch の算出列（player_keirin/player_autoraceの両方をLEFT JOINし、
 * どちらか一方にある値をCOALESCEで補う）。fetch() の行数を30行以下に抑えるため
 * モジュールスコープの定数に切り出す。
 */
const PLAYER_BRANCH_COLUMN = sql<
    string | null
>`COALESCE(${playerKeirin.branch}, ${playerAutorace.branch})`;

/**
 * fetch() の WHERE 条件を組み立てる。buildFetchQuery() の行数を30行以下に
 * 抑えるため切り出す。
 * @param raceTypeList - 絞り込み対象のレース種別一覧
 * @param playerName - 部分一致で絞り込む選手名（省略時は絞り込まない）
 */
const buildPlayerWhereCondition = (
    raceTypeList: SearchPlayerFilterParamsInput['raceTypeList'],
    playerName: string | undefined,
) =>
    and(
        inArray(player.raceType, raceTypeList),
        playerName === undefined
            ? undefined
            : like(player.playerName, `%${playerName}%`),
    );

@LogAllMethods
@injectable()
export class PlayerRepository implements IPlayerRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    /**
     * player テーブルへのバッチ INSERT（UPSERT）
     * @remarks
     * player は「観測した事実（選手コード・選手名）」のみを持つ。ユーザーが決める
     * priority は player_watch 側の責務であり、このテーブルへは書き込まない
     * （keirin-player-data-design.md §1.4: スクレイピングがpriorityを無条件上書きする
     * 事故を防ぐため、事実とユーザーの意思を別テーブルに分離した）。
     * ON CONFLICT のキーは複合キー (race_type, player_no)。
     * @param entities
     */
    private async batchInsertPlayer(entities: PlayerEntity[]): Promise<void> {
        await upsertPlayerFacts(this.drizzleGateway.db, entities);
    }

    /**
     * player_watch テーブルへのバッチ INSERT（UPSERT）
     * @remarks
     * `POST /player`（本メソッドの呼び出し元）はユーザーが注目選手を登録する
     * ための唯一の経路であり、ここで priority（ユーザーの意思）を書き込む。
     * スクレイピング経路（RaceRepository）はこのメソッドを一切呼ばない。
     * @param entities
     */
    private async batchInsertPlayerWatch(
        entities: PlayerEntity[],
    ): Promise<void> {
        if (entities.length === 0) return;
        const userId = requireCurrentUserId();
        await this.drizzleGateway.db
            .insert(playerWatch)
            .values(
                entities.map((entity) => ({
                    userId,
                    raceType: entity.raceType,
                    playerNo: entity.playerNo,
                    priority: entity.priority,
                })),
            )
            .onConflictDoUpdate({
                target: [
                    playerWatch.userId,
                    playerWatch.raceType,
                    playerWatch.playerNo,
                ],
                set: {
                    priority: sql`excluded.priority`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }

    /**
     * fetch 用の SELECT クエリを組み立てる。
     * @remarks
     * `player` テーブルの `PRIMARY KEY (race_type, player_no)` は先頭列 `race_type` の
     * プレフィックス検索にも使えるため、下記の `WHERE race_type IN (...)` は複合PKを
     * 暗黙のカバリングインデックスとして利用できる（別途 `race_type` 単体インデックスを
     * 追加しなくても検索コストは変わらない、PERF-056）。
     * priority は player_watch を LEFT JOIN して取得する（未登録の選手は0=注目しない）。
     * term は player_keirin を LEFT JOIN して補う（KEIRIN以外や未紐付けの選手は
     * undefinedになる）。branch は player_keirin/player_autorace の両方を LEFT JOIN し
     * COALESCEで補う（player_no は競技ごとに独立した採番のため、通常は両方に
     * 一致行が生じない）。
     * playerName が指定された場合は `LIKE '%playerName%'` による部分一致で絞り込む。
     * @param searchPlayerFilter - 検索条件（raceTypeList、任意でplayerName）
     */
    private buildFetchQuery(searchPlayerFilter: SearchPlayerFilterParamsInput) {
        const { raceTypeList, playerName } = searchPlayerFilter;
        const userId = requireCurrentUserId();
        return this.drizzleGateway.db
            .select({
                raceType: player.raceType,
                playerNo: player.playerNo,
                playerName: player.playerName,
                priority: sql<number>`COALESCE(${playerWatch.priority}, 0)`,
                term: playerKeirin.term,
                branch: PLAYER_BRANCH_COLUMN,
            })
            .from(player)
            .leftJoin(
                playerWatch,
                and(
                    eq(playerWatch.raceType, player.raceType),
                    eq(playerWatch.playerNo, player.playerNo),
                    eq(playerWatch.userId, userId),
                ),
            )
            .leftJoin(playerKeirin, eq(playerKeirin.playerNo, player.playerNo))
            .leftJoin(
                playerAutorace,
                eq(playerAutorace.playerNo, player.playerNo),
            )
            .where(buildPlayerWhereCondition(raceTypeList, playerName))
            .orderBy(asc(player.playerNo))
            .limit(FETCH_ROW_LIMIT);
    }

    /**
     * @param searchPlayerFilter - 検索条件（raceTypeList、任意でplayerName）
     * @returns 条件に合致する選手エンティティ一覧
     */
    public async fetch(
        searchPlayerFilter: SearchPlayerFilterParamsInput,
    ): Promise<PlayerEntity[]> {
        const rows = await this.buildFetchQuery(searchPlayerFilter);

        // Gatewayから返されたデータを検証して、PlayerEntityに変換
        return rows.map((row): PlayerEntity => PlayerMapper.toEntity(row));
    }

    public async upsert(entityList: PlayerEntity[]): Promise<UpsertResult> {
        // entityListの型（PlayerEntity[]）はdomain層で検証済みのため、
        // ここはビジネスロジック（データベース操作）に専念
        const result = createEmptyUpsertResult();
        if (entityList.length === 0) return result;

        // バッチ処理: チャンク単位でデータを処理（D1のSQLバインド変数上限対応）
        await processInChunks(
            entityList,
            PLAYER_UPSERT_CHUNK_SIZE,
            async (chunk) => {
                await this.batchInsertPlayer(chunk);
                await this.batchInsertPlayerWatch(chunk);
                recordUpsertChunkSuccess(result, chunk);
            },
            (chunk, error) =>
                recordUpsertChunkFailure(result, chunk, error, {
                    db: 'player',
                    source: 'PlayerRepository',
                    idOf: (entity) => entity.playerNo,
                }),
        );
        return result;
    }
}
