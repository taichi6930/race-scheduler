import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type * as schema from '../../db/schema';
import { player } from '../../db/schema';
import { chunkArray } from './chunkArray';
import { resolveUpsertChunkSize } from './upsertChunk';

/**
 * `player` テーブルへ書き込む観測事実（選手コード・選手名）。
 * priority（ユーザーの意思）はここに含めない — player_watch側の責務。
 */
export interface PlayerFact {
    raceType: string;
    playerNo: string;
    playerName: string;
}

/**
 * player テーブル 1 行あたりのバインド変数数
 * （race_type, player_no, player_name, priority。priorityは新規行のNOT NULL制約を
 * 満たすため常に0で書き込んでおり、値が固定でもdrizzleはバインドパラメータとして
 * 送出するため、チャンクサイズの算出に含める必要がある）。
 * @remarks
 * この値を3のままにしていたため（priority列を数え忘れ）、1チャンクあたりの
 * 実バインド数が floor(100/3)=33行×4パラメータ=132 個となりD1の上限(100)を
 * 超過し、選手数の多いレース群（KEIRIN/BOATRACE問わず）で `/sync/race` が
 * 500エラーになっていた。
 */
const PLAYER_FACT_PARAMS_PER_ROW = 4;

/**
 * D1のバインド変数上限に収まるチャンクサイズ（floor(100 / 4) = 25）。
 * @remarks
 * PlayerRepository は entityList 自体を既にこのサイズ以下に分割して呼ぶため
 * 実質1チャンクだが、RaceRepository（KPLAYER-05）は1レースチャンクあたり
 * 最大9選手 × 12レース分の選手ファクトを一度に渡しうるため、この関数自身が
 * 内部でチャンク分割することで両呼び出し元を安全にする。
 */
const PLAYER_FACT_UPSERT_CHUNK_SIZE = resolveUpsertChunkSize(
    PLAYER_FACT_PARAMS_PER_ROW,
);

/**
 * player テーブル（選手マスタ・観測事実のみ）へのバッチ INSERT（UPSERT）。
 * @remarks
 * PlayerRepository（`POST /player`）と RaceRepository（スクレイピング経由、
 * KPLAYER-05）の双方から呼ばれる共通ロジック。priority 列（ユーザーの意思。
 * player_watch が正）へは一切書き込まない
 * （keirin-player-data-design.md §1.4: スクレイピングがpriorityを無条件
 * 上書きしユーザー設定が毎日消える事故を防ぐため、書き込み経路を集約する）。
 * ON CONFLICT のキーは複合キー (race_type, player_no)。
 * @param db - Drizzle ORM のクエリビルダインスタンス
 * @param facts - 書き込む選手ファクト一覧
 */
export const upsertPlayerFacts = async (
    db: DrizzleD1Database<typeof schema>,
    facts: PlayerFact[],
): Promise<void> => {
    if (facts.length === 0) return;
    for (const chunk of chunkArray(facts, PLAYER_FACT_UPSERT_CHUNK_SIZE)) {
        await db
            .insert(player)
            .values(
                chunk.map((fact) => ({
                    raceType: fact.raceType,
                    playerNo: fact.playerNo,
                    playerName: fact.playerName,
                    // 新規行のNOT NULL制約を満たすためだけの値。以降このメソッドは
                    // priority列を更新しない（読み取りはplayer_watch側を正とする）。
                    priority: 0,
                })),
            )
            .onConflictDoUpdate({
                target: [player.raceType, player.playerNo],
                set: {
                    playerName: sql`excluded.player_name`,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                },
            });
    }
};
