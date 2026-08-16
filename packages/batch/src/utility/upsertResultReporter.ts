/**
 * @file Upsert結果（成功/失敗件数）の共通レポーター（OBS-027）
 *
 * `runPlaceBatch`/`runRaceBatch` は scraping Worker への同期依頼
 * （`syncScrapingPlaceList`/`syncScrapingRaceList`）が返す `successCount`/
 * `failureCount`/`failures` のうち、従来は `successCount` のみを呼び出し元
 * （`orchestrator.ts` の `executeBatch`）へ返しており、`failureCount`/`failures`
 * を握りつぶしていた。`executeBatch` は例外が投げられた場合のみ失敗として
 * 記録するため、この握りつぶしにより「一部の開催場/レースが失敗しても
 * successCountが小さくなるだけ」で、CLIサマリ・ワークフローの終了コードの
 * どちらにも失敗が伝わらなかった。
 *
 * `runCalendarBatch`（`batch/calendar.ts`）は既に「失敗が1件でもあれば例外を
 * 投げる」実装になっていたため、place/race 側もこれに合わせる形で統一する。
 */

import type { UpsertApiResponse } from '@race-schedule/core';
import { appLogger } from '@race-schedule/core';

/**
 * Upsert結果に失敗が1件以上あればログ出力した上で例外を投げ、
 * 無ければ成功件数をそのまま返す。
 *
 * `executeBatch`（`orchestrator.ts`）の catch ブロックがこの例外を捕捉し、
 * `BatchResult.failures` へ記録することで、CLIサマリ（`cli.ts` の
 * `printSummary`）・ワークフローの終了コードの両方に失敗が伝播するようになる。
 * @param contextLabel - ログ・エラーメッセージに使う処理名（例: 'Place sync'）
 * @param response - scraping Worker の同期エンドポイントからのレスポンス
 * @returns 失敗が無い場合の成功件数
 * @throws 失敗が1件以上ある場合
 */
export function reportUpsertFailuresOrThrow(
    contextLabel: string,
    response: UpsertApiResponse,
): number {
    if (response.failureCount === 0) {
        return response.successCount;
    }

    const detail = response.failures
        .map((failure) => `${failure.id}: ${failure.reason}`)
        .join('; ');
    appLogger.error(
        `${contextLabel} had ${response.failureCount} failure(s): ${detail}`,
    );
    throw new Error(
        `${contextLabel} failed for ${response.failureCount} item(s): ${detail}`,
    );
}
