/**
 * データ品質警告監視（DATA-01対応）のオーケストレーション。
 * `scheduled.ts` から既存のCloudflareエラー監視と同じ1時間おきcronで呼ばれ、
 * `data_quality_warning_log` を直近ウィンドウでsourceごとに集計し、
 * `dataQualityWarningNotifier.syncDataQualityWarningIssue` へ渡す。
 * @remarks
 * リクエスト処理中（例: PlaceRepository.fetch）はDBへ警告行を記録するだけで
 * GitHub APIを呼ばない。GitHub API呼び出しはこのバッチ処理内でのみ行うことで、
 * ユーザーへのレスポンス速度・信頼性に影響を与えない設計にしている。
 */

import {
    appLogger,
    DI_TOKENS,
    EnvStore,
    GithubIssueGateway,
} from '@race-schedule/core';
import { and, eq, gte } from 'drizzle-orm';
import { container } from 'tsyringe';
import { dataQualityWarningLog } from '../db/schema';
import type { IDrizzleGateway } from '../gateway/interface/IDrizzleGateway';
import type { DataQualityWarningCheckResult } from './dataQualityWarningNotifier';
import { syncDataQualityWarningIssue } from './dataQualityWarningNotifier';

/**
 * 監視対象source一覧。将来同種のスキップ処理を他のマッパー（race_mapper等）に
 * 展開する際はここへ追加するだけでよい。
 */
const SOURCES = ['place_mapper'];

/** 集計期間のさかのぼり幅（分）。errorMonitorCheck.tsと同じ70分（cron実行遅延バッファ込み）。 */
const WINDOW_MINUTES = 70;

const MAX_SAMPLE_MESSAGES = 5;

/**
 * 1source分のチェックを実行する。
 * @param source
 * @param drizzleGateway
 * @param windowStart
 * @param windowEnd
 * @param gateway
 * @param githubToken
 */
async function checkOneSource(
    source: string,
    drizzleGateway: IDrizzleGateway,
    windowStart: Date,
    windowEnd: Date,
    gateway: GithubIssueGateway,
    githubToken: string,
): Promise<void> {
    const rows = await drizzleGateway.db
        .select({ message: dataQualityWarningLog.message })
        .from(dataQualityWarningLog)
        .where(
            and(
                eq(dataQualityWarningLog.source, source),
                gte(dataQualityWarningLog.createdAt, windowStart.toISOString()),
            ),
        );

    appLogger.info(
        `[dataQualityWarningCheck] ${source}: count=${String(rows.length)}`,
    );

    const result: DataQualityWarningCheckResult = {
        source,
        count: rows.length,
        sampleMessages: rows
            .slice(0, MAX_SAMPLE_MESSAGES)
            .map((row) => row.message),
        windowStartIso: windowStart.toISOString(),
        windowEndIso: windowEnd.toISOString(),
    };

    await syncDataQualityWarningIssue(result, gateway, githubToken);
}

/**
 * データ品質警告チェックを1回実行する。`GITHUB_TOKEN`が未設定の場合は
 * 何もせずスキップする（graceful degradation）。1source分のチェックが
 * 失敗しても他sourceのチェックは継続する（errorMonitorCheck.tsと同じ方針）。
 * @param now - 基準時刻（UTC、テスト容易性のため注入可能にしている）
 */
export async function runDataQualityWarningCheck(now: Date): Promise<void> {
    const githubToken = EnvStore.env.GITHUB_TOKEN;
    if (!githubToken) {
        appLogger.warn(
            '[dataQualityWarningCheck] GITHUB_TOKEN が未設定のためスキップします',
        );
        return;
    }

    const gateway = new GithubIssueGateway('race-schedule-api');
    const drizzleGateway = container.resolve<IDrizzleGateway>(
        DI_TOKENS.DrizzleGateway,
    );
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60_000);

    for (const source of SOURCES) {
        try {
            await checkOneSource(
                source,
                drizzleGateway,
                windowStart,
                now,
                gateway,
                githubToken,
            );
        } catch (error) {
            appLogger.warn(
                `[dataQualityWarningCheck] ${source} のチェックに失敗しました`,
                error,
            );
        }
    }
}
