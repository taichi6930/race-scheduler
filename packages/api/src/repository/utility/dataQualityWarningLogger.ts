import { appLogger } from '@race-schedule/core';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type * as schema from '../../db/schema';
import { dataQualityWarningLog } from '../../db/schema';

type WarningDb = DrizzleD1Database<typeof schema>;

/**
 * データ品質警告（マッピング失敗でスキップした行など）を `data_quality_warning_log`
 * へベストエフォートで記録する。
 * @remarks
 * 呼び出し元（例: PlaceRepository.fetch）は読み取り系のリクエストであるため、
 * この記録処理自体が失敗してもリクエストを失敗させない（catchして警告ログのみ）。
 * api Worker の scheduled ハンドラ（既存の Cloudflare エラー監視と同じ1時間おきcron）
 * がこのテーブルを直近ウィンドウでCOUNTし、GitHub Issueの作成/追記/Closeに使う。
 * @param db - Drizzle ORM のクエリビルダインスタンス
 * @param source - 記録元の識別子（例: 'place_mapper'）
 * @param messages - 記録する警告メッセージ一覧（空配列なら何もしない）
 */
export async function recordDataQualityWarning(
    db: WarningDb,
    source: string,
    messages: string[],
): Promise<void> {
    if (messages.length === 0) return;
    try {
        await db
            .insert(dataQualityWarningLog)
            .values(messages.map((message) => ({ source, message })));
    } catch (error) {
        appLogger.warn(
            `[dataQualityWarningLogger] Failed to record ${String(messages.length)} warning(s) for source=${source}`,
            error,
        );
    }
}
