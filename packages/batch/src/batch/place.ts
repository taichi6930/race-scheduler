/**
 * 開催場日程バッチ処理
 *
 * 処理フロー：
 * 1. scraping Worker の同期エンドポイント（POST /sync/place）に
 *    開催場情報のスクレイピング＋メインAPIへのUpsertを依頼
 */

import { syncScrapingPlaceList } from '../client/scraping';
import type { BatchConfig } from '../types';
import { reportUpsertFailuresOrThrow } from '../utility/upsertResultReporter';

/**
 * 開催場情報バッチを実行
 * @param config バッチ実行設定（レース種別、開始日、終了日）
 * @returns メインAPIへの登録に成功した開催場数
 * @throws API通信エラー、または開催場の同期に1件以上失敗した場合（OBS-027）
 */
export async function runPlaceBatch(config: BatchConfig): Promise<number> {
    const result = await syncScrapingPlaceList(
        config.raceType,
        config.startDate,
        config.finishDate,
    );
    return reportUpsertFailuresOrThrow('Place sync', result);
}
