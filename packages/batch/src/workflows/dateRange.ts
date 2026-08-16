/**
 * Workflows 版 batch-all（CICD-73）の日付レンジ計算。
 *
 * `.github/workflows/batch-all.yml` の `set-dates` ジョブと同じレンジ
 * （schedule 実行前提: startDate=昨日, finishDate=明日, raceFinishDate=+2日
 * （NARのみ+4日）, calendarFinishDate=+4日）を再現する。GitHub Actions側は
 * シェルの `date -d` コマンドで計算していたが、Workers 実行環境には無いため、
 * `@race-schedule/core` の JST 日付ユーティリティ（`createJstDate`/
 * `toJstISOString`）で移植する。`packages/batch/src/batch/calendar.ts` の
 * `toInclusiveFinishDateString` と同じ「ローカルタイムゾーン非依存」の方針。
 */

import {
    createJstDate,
    formatDayDigits,
    formatMonthDigits,
    getJstYear,
    RaceType,
    toJstISOString,
} from '@race-schedule/core';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 基準時刻から JST の「今日」を YYYY-MM-DD 文字列で返す。
 * @param now 基準時刻
 * @returns JST の日付文字列（YYYY-MM-DD）
 */
function todayJstDateString(now: Date): string {
    const year = getJstYear(now);
    const month = formatMonthDigits(now, 2);
    const day = formatDayDigits(now, 2);
    return `${year}-${month}-${day}`;
}

/**
 * YYYY-MM-DD 文字列に日数を加算した YYYY-MM-DD 文字列を返す（JST基準）。
 * @param dateStr 基準日（YYYY-MM-DD）
 * @param days 加算する日数（負数で減算）
 * @returns 加算後の日付文字列（YYYY-MM-DD）
 */
function addDaysJst(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const base = createJstDate(year, month, day);
    const shifted = new Date(base.getTime() + days * ONE_DAY_MS);
    return toJstISOString(shifted).slice(0, 10);
}

/** Workflows 版 batch-all の日付レンジ */
export interface BatchDateRange {
    /** place/race/calendar 共通の開始日 */
    startDate: string;
    /** place バッチの終了日 */
    finishDate: string;
    /** calendar バッチの終了日 */
    calendarFinishDate: string;
    /**
     * race バッチの終了日を raceType 別に返す。
     * NAR は開催場データの `isRaceListAvailable` 判定により未公開日が自動除外
     * されるため、他種別より長い期間を取得しても無駄打ちにならない
     * （`batch-all.yml` の `Run Race Batch` ステップと同じ判断）。
     * @param raceType 対象レース種別
     */
    raceFinishDateFor: (raceType: RaceType) => string;
}

/**
 * schedule 実行前提で `batch-all.yml` の `set-dates` ジョブと同じ日付レンジを計算する。
 * @param now 基準時刻（Workflow の `event.timestamp` を渡す想定）
 * @returns 計算済みの日付レンジ
 */
export function computeScheduledDateRange(now: Date): BatchDateRange {
    const today = todayJstDateString(now);
    const startDate = addDaysJst(today, -1);
    const finishDate = addDaysJst(today, 1);
    const calendarFinishDate = addDaysJst(today, 4);
    const raceFinishDateDefault = addDaysJst(today, 2);
    const raceFinishDateNar = addDaysJst(today, 4);

    return {
        startDate,
        finishDate,
        calendarFinishDate,
        raceFinishDateFor: (raceType) =>
            raceType === RaceType.NAR
                ? raceFinishDateNar
                : raceFinishDateDefault,
    };
}

/**
 * 手動トリガー（batch-race/place/calendar.yml統合後）向けに、指定された単一の
 * 開始日・終了日をplace/race/calendarの全ターゲットへ一律に適用するレンジを作る。
 * `computeScheduledDateRange`と異なり、NARの race 終了日延長・calendar の
 * +4日拡張は行わない（schedule実行専用のロジックのため）。
 * @param startDate 開始日（YYYY-MM-DD）
 * @param finishDate 終了日（YYYY-MM-DD）
 * @returns startDate/finishDateを全ターゲットへ一律適用するレンジ
 */
export function buildFixedDateRange(
    startDate: string,
    finishDate: string,
): BatchDateRange {
    return {
        startDate,
        finishDate,
        calendarFinishDate: finishDate,
        raceFinishDateFor: () => finishDate,
    };
}
