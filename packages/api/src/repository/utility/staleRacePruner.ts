import type { RaceEntity } from '@race-schedule/core';
import { appLogger, parsePlaceId, validatePlaceId } from '@race-schedule/core';
import { inArray } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type * as schema from '../../db/schema';
import { race, raceCondition, raceStage } from '../../db/schema';
import { chunkArray } from './chunkArray';
import { D1_MAX_BIND_VARS } from './upsertChunk';

type RaceDb = DrizzleD1Database<typeof schema>;

/**
 * findStaleRaceIds（placeId の IN 句）・deleteStaleRaceRows（raceId の IN 句）の
 * チャンクサイズ。
 * @remarks
 * placeId/raceId のいずれも IN 句のバインド変数を1件消費するのみのため、
 * D1_MAX_BIND_VARS をそのままチャンクサイズとして使う
 * （calendarRepository.FLAGGED_RACE_IDS_CHUNK_SIZE と同じ考え方）。
 * scraping の /sync/race は同期対象期間（当日〜+N日）に含まれる全開催場・
 * 全レースを1回のPOSTにまとめて送るため、NAR/KEIRIN等でplaceId・raceIdの
 * 件数が100件を超えるとD1のバインド変数上限超過でupsert全体が500になっていた
 * （Issue #2378。#2350で修正したfetchWatchedRaceIds/fetchFlaggedRaceIdsと
 * 同種の未チャンク分割クエリが、upsertの後始末であるpruneStaleRaces側にも
 * 残っていたのが原因）。
 */
const STALE_RACE_CHUNK_SIZE = D1_MAX_BIND_VARS;

/**
 * 開催場ごとの、今回実際に取得できたレースの日時範囲（JST ISO8601文字列）。
 * ISO8601形式は文字列としての大小比較が日時の前後関係と一致するため、
 * Dateへ変換せず文字列のまま比較できる。
 */
interface DateTimeRange {
    minDateTime: string;
    maxDateTime: string;
}

/**
 * `RaceRepository.upsert` の後始末として、今回取得できなくなった過去のレースを
 * 削除する処理をまとめたモジュール。
 * @remarks
 * スクレイピングは直近の開催のみを対象に行われるため、ある開催場のレースが
 * 実際に取得できた時点＝その開催の番組がほぼ確定した時点とみなせる。
 * そのため、取得結果に無い古いレース（例: 年始の暫定登録時点では12Rまで
 * あったが、実際の番組では10Rまでしかなかった等）は不要な残存データとして削除する。
 */

/**
 * fetch 成功済みエンティティを、失敗した placeId を除外しつつ
 * placeId → 最新の raceId 集合、へのマップに集約する。
 * @param succeededEntities - upsert に成功したレースエンティティ一覧
 * @param failedPlaceIds - 今回の取得が不完全だった placeId 集合（除外対象）
 */
export const buildFreshRaceIdsByPlace = (
    succeededEntities: RaceEntity[],
    failedPlaceIds: Set<string>,
): Map<string, Set<string>> => {
    const placeIdToFreshRaceIds = new Map<string, Set<string>>();
    for (const entity of succeededEntities) {
        if (failedPlaceIds.has(entity.placeId)) continue;
        const freshRaceIds =
            placeIdToFreshRaceIds.get(entity.placeId) ?? new Set<string>();
        freshRaceIds.add(entity.raceId);
        placeIdToFreshRaceIds.set(entity.placeId, freshRaceIds);
    }
    return placeIdToFreshRaceIds;
};

/**
 * fresh 集合が存在する開催場ごとに、placeId が表す開催日（JST）の一日の範囲
 * （00:00:00〜23:59:59）を求める。
 * @remarks
 * CONC-04: 異なる取得期間（例: 直近7日分と直近30日分）の同期が同じ開催場に対して
 * 重なって実行されると、期間が狭い方の fresh 集合には期間が広い方が正当に登録した
 * 未来のレースが含まれず、stale と誤判定されて削除されてしまう。この範囲を
 * `findStaleRaceIds` の削除候補の絞り込みに使うことで、「今回取得対象とした
 * 開催日の外側」にあるレースは fresh 集合に無くても削除対象から除外できる。
 *
 * 以前は今回取得できたエンティティ自身の日時の min/max を範囲としていたが、
 * これだと開催が打ち切りになり末尾のレースが丸ごと欠落したケース（例: 12R予定が
 * 落車多発により11Rで打ち切られた）で、実在しない旧12Rのゴーストレコードの日時が
 * 範囲の外側と判定され、削除対象から漏れてしまっていた。
 * placeId は開催日を一意に含む（{@link composePlaceId}）ため、取得できた
 * エンティティの内容に依存せず placeId 自体から当日の範囲を直接算出することで、
 * 同一開催日内の欠落レースは確実に削除対象にしつつ、異なる開催日（＝異なる
 * placeId）のレースは従来どおり保護する。
 * @param placeIds - 今回 fresh 集合が存在する placeId 一覧
 */
export const buildFetchedDateTimeRangeByPlace = (
    placeIds: Iterable<string>,
): Map<string, DateTimeRange> => {
    const rangeByPlace = new Map<string, DateTimeRange>();
    for (const placeId of placeIds) {
        const { date } = parsePlaceId(validatePlaceId(placeId));
        const yyyyMMdd = buildJstDateSegment(date);
        rangeByPlace.set(placeId, {
            minDateTime: `${yyyyMMdd}T00:00:00+09:00`,
            maxDateTime: `${yyyyMMdd}T23:59:59+09:00`,
        });
    }
    return rangeByPlace;
};

/**
 * placeId から復元した開催日（ローカルタイムの年月日コンポーネントで構築された
 * Date）を `yyyy-MM-dd` 形式の文字列に変換する。
 * @remarks
 * `decomposePlaceId` の日付は `new Date(year, month - 1, day)` で構築されており、
 * タイムゾーン変換を経ていないローカル日時コンポーネントのDateである。
 * ここでも同じくローカル日時コンポーネント（`getFullYear`/`getMonth`/`getDate`）で
 * 読み戻すことで、実行環境のタイムゾーンに関わらず常に構築時と同じ年月日を得る。
 * @param date - `decomposePlaceId` が返す開催日
 * @returns `yyyy-MM-dd` 形式の日付文字列
 */
const buildJstDateSegment = (date: Date): string => {
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * staleRaceIds に対応する race_condition → race_stage → race の行を削除する
 * （従来と同一の削除順）。D1のバインド変数上限を超えないよう、raceIdを
 * チャンク分割してチャンクごとに逐次削除する。
 * @param db - Drizzle ORM のクエリビルダインスタンス
 * @param staleRaceIds - 削除対象の raceId 一覧
 */
const deleteStaleRaceRows = async (
    db: RaceDb,
    staleRaceIds: string[],
): Promise<void> => {
    for (const chunk of chunkArray(staleRaceIds, STALE_RACE_CHUNK_SIZE)) {
        await db
            .delete(raceCondition)
            .where(inArray(raceCondition.raceId, chunk));
        await db.delete(raceStage).where(inArray(raceStage.raceId, chunk));
        await db.delete(race).where(inArray(race.raceId, chunk));
    }
};

/**
 * placeIdToFreshRaceIds に登録された開催場全件について、DBに現存する
 * raceId（+ 所属placeId）をまとめて取得し、対応する placeId の
 * fresh raceId 集合に含まれない raceId を stale と判定する。
 * @remarks
 * PERF-038: 従来は placeId ごとに `SELECT ... WHERE place_id = ?` を発行しており
 * （N+1）、開催場数が多いPOST時に応答時間が線形増加していた。対象 placeId 全体を
 * `WHERE place_id IN (...)` のクエリで取得するよう集約する。
 * D1のバインド変数上限（100件）を超えないよう、placeIdをチャンク分割して
 * 並列にクエリする（Issue #2378）。
 * @param db - Drizzle ORM のクエリビルダインスタンス
 * @param placeIdToFreshRaceIds - placeId → 今回取得できた最新の raceId 集合
 * @param dateRangeByPlace - placeId → 今回実際に取得を試みたレースの日時範囲
 * （CONC-04。この範囲外のレースは fresh 集合に無くても削除対象にしない）
 * @returns stale と判定された raceId 一覧
 * @remarks
 * `pruneStaleRaces` からのみ呼ばれる内部関数だが、`dateRangeByPlace` に
 * `placeIdToFreshRaceIds` と不整合なキー集合を直接渡すケース（本来は
 * `buildFetchedDateTimeRangeByPlace` で必ず同じキー集合になる防御的分岐）を
 * 単体テストで検証するため export している。
 */
export const findStaleRaceIds = async (
    db: RaceDb,
    placeIdToFreshRaceIds: Map<string, Set<string>>,
    dateRangeByPlace: Map<string, DateTimeRange>,
): Promise<string[]> => {
    const placeIds = [...placeIdToFreshRaceIds.keys()];
    const chunks = chunkArray(placeIds, STALE_RACE_CHUNK_SIZE);
    const chunkRows = await Promise.all(
        chunks.map((chunk) =>
            db
                .select({
                    raceId: race.raceId,
                    placeId: race.placeId,
                    dateTime: race.dateTime,
                })
                .from(race)
                .where(inArray(race.placeId, chunk)),
        ),
    );
    const rows = chunkRows.flat();

    return rows
        .filter((row) => {
            const freshRaceIds = placeIdToFreshRaceIds.get(row.placeId);
            const isMissingFromFreshResult =
                freshRaceIds === undefined || !freshRaceIds.has(row.raceId);
            if (!isMissingFromFreshResult) return false;

            const range = dateRangeByPlace.get(row.placeId);
            if (!range) return false;
            return isWithinFetchedRange(row.dateTime, range);
        })
        .map((row) => row.raceId);
};

/**
 * dateTime が開催場の取得日時範囲（両端含む）に収まっているかを判定する。
 * @param dateTime - 判定対象のレースの日時（JST ISO8601文字列）
 * @param range - 開催場の取得日時範囲
 */
const isWithinFetchedRange = (
    dateTime: string,
    range: DateTimeRange,
): boolean => dateTime >= range.minDateTime && dateTime <= range.maxDateTime;

/**
 * 今回取得できた開催場について、取得結果に含まれなくなったレースを削除する。
 *
 * 安全のため、チャンク処理で一部でも失敗した開催場（failedPlaceIds）は
 * 今回の取得結果が不完全な可能性があるため、削除対象から除外する。
 *
 * PERF-038: 現存raceIdの取得を対象開催場全体で1クエリに集約したため、
 * SELECT失敗時のエラーハンドリングも開催場ごとではなく全体で1回のtry/catchに
 * まとめている（一部の開催場のみ prune をスキップする、という従来の粒度は
 * 失われるが、そもそも取得結果が不完全な開催場は failedPlaceIds で事前に
 * 除外済みのため実質的な安全性は変わらない）。
 * @param db - Drizzle ORM のクエリビルダインスタンス
 * @param succeededEntities - upsert に成功したレースエンティティ一覧
 * @param failedPlaceIds - 今回の取得が不完全だった placeId 集合（除外対象）
 */
export const pruneStaleRaces = async (
    db: RaceDb,
    succeededEntities: RaceEntity[],
    failedPlaceIds: Set<string>,
): Promise<void> => {
    const placeIdToFreshRaceIds = buildFreshRaceIdsByPlace(
        succeededEntities,
        failedPlaceIds,
    );

    if (placeIdToFreshRaceIds.size === 0) return;

    const dateRangeByPlace = buildFetchedDateTimeRangeByPlace(
        placeIdToFreshRaceIds.keys(),
    );

    try {
        const staleRaceIds = await findStaleRaceIds(
            db,
            placeIdToFreshRaceIds,
            dateRangeByPlace,
        );

        if (staleRaceIds.length === 0) return;

        await deleteStaleRaceRows(db, staleRaceIds);
        appLogger.info(
            `[RaceRepository] Pruned ${staleRaceIds.length} stale race(s) across ${placeIdToFreshRaceIds.size} place(s): ${staleRaceIds.join(', ')}`,
        );
    } catch (error: unknown) {
        appLogger.warn(
            `[RaceRepository] Failed to prune stale races for ${placeIdToFreshRaceIds.size} place(s)`,
            error,
        );
    }
};
