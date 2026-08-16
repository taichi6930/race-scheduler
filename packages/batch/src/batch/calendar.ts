/**
 * カレンダー情報バッチ処理
 * 指定期間のレース情報をGoogle Calendarに同期
 *
 * 処理フロー：
 * 1. 終了日に1日足してcalendar Workerに提供（startDate 0:00 〜 finishDate 0:00 のレースを含めるため）
 * 2. calendar Workerがメインapiからレース・カレンダー登録フラグ情報を取得し、
 *    Google Calendarに登録する（POST /sync）
 */

import { appLogger, createJstDate, toJstISOString } from '@race-schedule/core';

import { syncCalendar } from '../client/calendar';
import type { BatchConfig } from '../types';

type SyncCalendarResponse = Awaited<ReturnType<typeof syncCalendar>>;

/** 1日分のミリ秒（JSTには夏時間が無いため一律加算で安全、dateJst.tsの前提と同じ）。 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 終了日に1日足した日付文字列を返す（startDate 0:00 ～ finishDate 0:00 のレースを含めるため）。
 * @param finishDate 終了日（yyyy-MM-dd）
 * @remarks
 * PERF-185: 従来は `new Date(finishDate)`（UTCとして解釈）を`Date.prototype.getDate`/
 * `setDate`（実行環境のローカルタイムゾーンに依存）で加算していたため、Workers実行環境の
 * タイムゾーン設定次第で日付境界がずれるリスクがあった。`createJstDate`/`toJstISOString`
 * （実行環境のローカルタイムゾーンに依存しないJST基準の日付操作、dateJst.ts参照）に統一する。
 */
function toInclusiveFinishDateString(finishDate: string): string {
    const [year, month, day] = finishDate.split('-').map(Number);
    const nextDay = new Date(
        createJstDate(year, month, day).getTime() + ONE_DAY_MS,
    );
    return toJstISOString(nextDay).slice(0, 10);
}

/**
 * カレンダー同期結果をログ出力し、失敗があれば例外を投げる。
 * @param response syncCalendar のレスポンス
 * @returns 登録/更新/削除数の合計
 * @throws 同期失敗が1件以上ある場合
 */
function reportCalendarSyncResult(response: SyncCalendarResponse): number {
    const count =
        (response.insertedCount ?? 0) +
        (response.updatedCount ?? 0) +
        (response.deletedCount ?? 0);
    appLogger.info(
        `Upserted calendar: created=${response.insertedCount ?? 0}, updated=${response.updatedCount ?? 0}, deleted=${response.deletedCount ?? 0}`,
    );

    const failureCount = response.failureCount ?? 0;
    if (failureCount > 0) {
        const detail = response.failures
            .map((failure) => `${failure.id}: ${failure.reason}`)
            .join('; ');
        appLogger.error(
            `Calendar sync had ${failureCount} failure(s): ${detail}`,
        );
        throw new Error(
            `Calendar sync failed for ${failureCount} item(s): ${detail}`,
        );
    }

    return count;
}

/**
 * カレンダー情報バッチを実行
 * @param config バッチ実行設定（レース種別、開始日、終了日）
 * @returns 登録/更新数の合計
 * @throws API通信エラー等
 */
export async function runCalendarBatch(config: BatchConfig): Promise<number> {
    appLogger.info(
        `=== Calendar Batch: ${config.raceType} ${config.startDate} ~ ${config.finishDate} ===`,
    );

    const finishDateString = toInclusiveFinishDateString(config.finishDate);

    const response = await syncCalendar(
        [config.raceType],
        config.startDate,
        finishDateString,
    );

    return reportCalendarSyncResult(response);
}
