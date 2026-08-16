import type { RaceEntity } from '@race-schedule/core';
import { appLogger, generateRacePlayerId } from '@race-schedule/core';
import { inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type * as schema from '../../db/schema';
import { racePlayer } from '../../db/schema';
import { chunkArray } from './chunkArray';
import { D1_MAX_BIND_VARS } from './upsertChunk';

type RaceDb = DrizzleD1Database<typeof schema>;

/**
 * findStaleRacePlayerIds（raceId の IN 句）・削除（racePlayerId の IN 句）の
 * チャンクサイズ。
 * @remarks
 * raceId/racePlayerId のいずれも IN 句のバインド変数を1件消費するのみのため、
 * D1_MAX_BIND_VARS をそのままチャンクサイズとして使う
 * （staleRacePruner.STALE_RACE_CHUNK_SIZE と同じ考え方）。
 * KEIRINは全レースがplayerListを持つため、scrapingの/sync/raceが同期対象期間
 * （当日〜+N日）分をまとめて1回のPOSTで送ると対象raceId数が100件を超えやすく、
 * このチャンク分割が無いとD1のバインド変数上限超過でupsert全体が500になっていた
 * （Issue #2378）。
 */
const STALE_RACE_PLAYER_CHUNK_SIZE = D1_MAX_BIND_VARS;

/**
 * `RaceRepository.upsert` の後始末として、今回の出走表に含まれなくなった
 * race_player 行（欠場等で選手が減った場合）を削除する。
 * aidlc-docs/inception/application-design/keirin-player-data-design.md §4.8参照。
 * @remarks
 * playerListが今回明示的に得られたレース（`entity.playerList !== undefined`）
 * だけを対象にする。playerListを持たないレース（KEIRIN以外、または解析結果が
 * 0名だったレース）については、既存のrace_player行に一切触れない
 * （不完全な情報で誤って削除しないため。staleRacePruner の failedPlaceIds
 * 除外と同じ「不確かな場合は削除しない」方針）。
 */

/**
 * playerListを持つ成功済みエンティティから、raceId → 今回の出走表に含まれる
 * racePlayerId集合、へのマップを組み立てる。
 * @param succeededEntities - upsert に成功したレースエンティティ一覧
 */
export const buildFreshRacePlayerIdsByRace = (
    succeededEntities: RaceEntity[],
): Map<string, Set<string>> => {
    const raceIdToFreshIds = new Map<string, Set<string>>();
    for (const entity of succeededEntities) {
        if (!entity.playerList) continue;
        const freshIds = new Set(
            entity.playerList.map((racePlayerEntity) =>
                generateRacePlayerId(entity.raceId, racePlayerEntity.carNumber),
            ),
        );
        raceIdToFreshIds.set(entity.raceId, freshIds);
    }
    return raceIdToFreshIds;
};

/**
 * 対象 raceId 全件について、DBに現存する race_player_id（+ 所属raceId）を
 * まとめて取得し、対応する raceId の fresh 集合に含まれない race_player_id を
 * stale と判定する（staleRacePruner.findStaleRaceIds と同じ発想）。D1の
 * バインド変数上限（100件）を超えないよう、raceIdをチャンク分割して並列に
 * クエリする（Issue #2378）。
 * @param db - Drizzle ORM のクエリビルダインスタンス
 * @param raceIdToFreshIds - raceId → 今回取得できた最新の racePlayerId 集合
 */
const findStaleRacePlayerIds = async (
    db: RaceDb,
    raceIdToFreshIds: Map<string, Set<string>>,
): Promise<string[]> => {
    const raceIds = [...raceIdToFreshIds.keys()];
    const chunks = chunkArray(raceIds, STALE_RACE_PLAYER_CHUNK_SIZE);
    const chunkRows = await Promise.all(
        chunks.map((chunk) =>
            db
                .select({
                    racePlayerId: racePlayer.racePlayerId,
                    raceId: racePlayer.raceId,
                })
                .from(racePlayer)
                .where(inArray(racePlayer.raceId, chunk)),
        ),
    );
    const rows = chunkRows.flat();

    return rows
        .filter((row) => {
            const freshIds = raceIdToFreshIds.get(row.raceId);
            return freshIds === undefined || !freshIds.has(row.racePlayerId);
        })
        .map((row) => row.racePlayerId);
};

/**
 * 今回playerListを取得できたレースについて、出走表に含まれなくなった
 * race_player行（欠場等）を削除する。
 * @param db - Drizzle ORM のクエリビルダインスタンス
 * @param succeededEntities - upsert に成功したレースエンティティ一覧
 */
export const pruneStaleRacePlayers = async (
    db: RaceDb,
    succeededEntities: RaceEntity[],
): Promise<void> => {
    const raceIdToFreshIds = buildFreshRacePlayerIdsByRace(succeededEntities);

    if (raceIdToFreshIds.size === 0) return;

    try {
        const staleIds = await findStaleRacePlayerIds(db, raceIdToFreshIds);

        if (staleIds.length === 0) return;

        for (const chunk of chunkArray(
            staleIds,
            STALE_RACE_PLAYER_CHUNK_SIZE,
        )) {
            await db
                .delete(racePlayer)
                .where(inArray(racePlayer.racePlayerId, chunk));
        }
        appLogger.info(
            `[RaceRepository] Pruned ${staleIds.length} stale race_player row(s) across ${raceIdToFreshIds.size} race(s)`,
        );
    } catch (error: unknown) {
        appLogger.warn(
            `[RaceRepository] Failed to prune stale race_player rows for ${raceIdToFreshIds.size} race(s)`,
            error,
        );
    }
};
