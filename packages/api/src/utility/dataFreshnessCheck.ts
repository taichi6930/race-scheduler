/**
 * データ鮮度チェック（CICD-121）のオーケストレーション。
 * `scheduled.ts` から呼ばれ、DBから今日（JST）のレース数を取得し
 * `dataFreshnessNotifier.syncDataFreshnessIssue` へ渡す。
 */

import {
    appLogger,
    DI_TOKENS,
    EnvStore,
    GithubIssueGateway,
    RaceType,
} from '@race-schedule/core';
import { container } from 'tsyringe';

import type { IRaceUsecase } from '../usecase/interface/IRaceUsecase';
import { syncDataFreshnessIssue } from './dataFreshnessNotifier';

/** 全レース種別（`health-check-data-freshness.yml`のraceTypeListと同一） */
const ALL_RACE_TYPES: RaceType[] = [
    RaceType.JRA,
    RaceType.NAR,
    RaceType.KEIRIN,
    RaceType.AUTORACE,
    RaceType.BOATRACE,
    RaceType.OVERSEAS,
];

/**
 * 現在時刻（UTC）から「今日」のJST日付（YYYY-MM-DD）を求める。
 * @param now - 基準時刻（UTC）
 */
export function resolveTodayJst(now: Date): string {
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    // QJST-04: ここは `now` へ既に+9時間を加算済み（=JST時刻をUTC値として
    // 保持している）ため、toISOString().slice(0,10)はJST日付を正しく返す
    // （lintルールが警告する「未加算のDateにそのまま呼ぶ」パターンとは異なる）。
    // eslint-disable-next-line no-restricted-syntax
    return jst.toISOString().slice(0, 10);
}

/**
 * `resolveTodayJst`が返すYYYY-MM-DD文字列から、そのJST日付のJST深夜0時を
 * 表すDateを組み立てる（`searchRaceFilterParamsSchema`のstartDate/finishDateに
 * そのまま渡せる形。元のGitHub Actions版がHTTPクエリ文字列として渡していた
 * `startDate=finishDate=YYYY-MM-DD`と同じ範囲指定になる）。
 * @remarks QJST-07: 以前は `T00:00:00.000Z`（UTC深夜0時）としてパースしていたが、
 * `queryParamParser.ts`の`normalizeValue`と同じくJST深夜0時（`+09:00`）として
 * 解釈しないと、DB検索の`startDate`（JST日付の最後へ調整されない側）がJST 9時
 * 相当になり、当日0〜9時台のレースが集計から漏れる。
 * @param dateJst - YYYY-MM-DD形式の日付文字列
 */
export function toQueryDate(dateJst: string): Date {
    return new Date(`${dateJst}T00:00:00+09:00`);
}

/**
 * データ鮮度チェックを1回実行する。`GITHUB_TOKEN`が未設定の場合は何もせず
 * スキップする（graceful degradation）。通知処理自体の失敗は
 * `syncDataFreshnessIssue`内でベストエフォート処理されるため、ここでは
 * DBクエリの失敗のみtry/catchで警告ログに変換する。
 * @remarks 呼び出し側（`scheduled.ts`）が`ensureDIInitialized(env)`を先に
 * 呼んでいる前提のため、`EnvStore`/DIコンテナ経由でアクセスし`env`は受け取らない。
 * @param now - 基準時刻（UTC、テスト容易性のため注入可能にしている）
 */
export async function runDataFreshnessCheck(now: Date): Promise<void> {
    const token = EnvStore.env.GITHUB_TOKEN;
    if (!token) {
        appLogger.warn(
            '[dataFreshnessCheck] GITHUB_TOKEN が未設定のためスキップします',
        );
        return;
    }

    try {
        const checkDateJst = resolveTodayJst(now);
        const queryDate = toQueryDate(checkDateJst);

        const raceUsecase = container.resolve<IRaceUsecase>(
            DI_TOKENS.RaceUsecase,
        );
        const races = await raceUsecase.fetch({
            startDate: queryDate,
            finishDate: queryDate,
            raceTypeList: ALL_RACE_TYPES,
        });

        appLogger.info(
            `[dataFreshnessCheck] ${checkDateJst} (JST) の全レース種別合計: ${races.length}件`,
        );

        await syncDataFreshnessIssue(
            { checkDateJst, raceCount: races.length },
            new GithubIssueGateway('race-schedule-api'),
            token,
        );
    } catch (error) {
        appLogger.warn(
            '[dataFreshnessCheck] レース件数の取得に失敗しました',
            error,
        );
    }
}
