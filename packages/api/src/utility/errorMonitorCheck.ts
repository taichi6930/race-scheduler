/**
 * Cloudflareエラー監視（CICD-122）のオーケストレーション。
 * `scheduled.ts` から呼ばれ、対象Worker（既定は全5Worker）それぞれについて
 * Cloudflare GraphQL Analytics APIでエラー数を取得し、
 * `errorMonitorNotifier.syncErrorMonitorIssue` へ渡す。
 * @remarks
 * **既知の制約（自己監視のブラインドスポット）**: 本チェックはapi Worker自身の
 * scheduledハンドラとして動作するため、api自体が完全にクラッシュしてscheduled
 * ハンドラそのものが実行できない状態になった場合、api自身だけでなくadmin/batch/
 * calendar/scrapingの監視も同時に止まる（`dataFreshnessCheck.ts`が既に受け入れて
 * いるのと同じトレードオフ）。これは「特定Workerのfetchハンドラがエラーを返す」
 * 程度の障害では発生しない（scheduledハンドラは別エントリポイントのため）が、
 * Worker自体のデプロイ破損等の深刻な障害では有効な保険にならない。
 * GitHub Actions側（`error-monitor.yml`）は、この制約を踏まえ並行稼働期間を経て
 * からカットオーバー判断を行う（`docs/tasks/BACKLOG.md` CICD-122参照）。
 */

import type { IGithubIssueGateway } from '@race-schedule/core';
import { appLogger, EnvStore, GithubIssueGateway } from '@race-schedule/core';

import { fetchWorkerErrorStats } from './cloudflareAnalyticsClient';
import { syncErrorMonitorIssue } from './errorMonitorNotifier';

/**
 * 監視対象キーとCloudflare上のスクリプト名の対応（error-monitor.ymlと同一）。
 * admin（障害対応そのものに使う画面）はQRUN-02で対象に追加した。
 */
const TARGET_SCRIPT_NAMES: Record<string, string> = {
    api: 'race-schedule-prod',
    admin: 'race-schedule-admin-prod',
    batch: 'race-schedule-batch-prod',
    calendar: 'race-schedule-calendar-prod',
    scraping: 'race-schedule-scraping-prod',
};

/** 全監視対象キー（api/admin/batch/calendar/scraping）。 */
export const ALL_ERROR_MONITOR_TARGETS = Object.keys(TARGET_SCRIPT_NAMES);

/** 集計期間のさかのぼり幅（分）。cronの実行遅延を考慮したバッファ込み（error-monitor.ymlと同じ70分）。 */
const WINDOW_MINUTES = 70;

/**
 * 1対象分のチェックを実行する。エラー・GraphQL API失敗時は
 * `fetchWorkerErrorStats`がnullを返すため、その場合は通知をスキップする。
 */
async function checkOneTarget(
    targetKey: string,
    scriptName: string,
    apiToken: string,
    accountId: string,
    now: Date,
    gateway: IGithubIssueGateway,
    githubToken: string,
): Promise<void> {
    const windowEndIso = now.toISOString();
    const windowStartIso = new Date(
        now.getTime() - WINDOW_MINUTES * 60_000,
    ).toISOString();

    const stats = await fetchWorkerErrorStats(
        apiToken,
        accountId,
        scriptName,
        windowStartIso,
        windowEndIso,
    );
    if (!stats) {
        return;
    }

    appLogger.info(
        `[errorMonitorCheck] ${scriptName}: errors=${stats.errorCount} requests=${stats.requestCount}`,
    );

    await syncErrorMonitorIssue(
        {
            targetKey,
            scriptName,
            errorCount: stats.errorCount,
            requestCount: stats.requestCount,
            windowStartIso,
            windowEndIso,
        },
        gateway,
        githubToken,
    );
}

/** `runErrorMonitorCheck`に必要な3つのシークレット（いずれも解決済み・非空）。 */
interface ErrorMonitorSecrets {
    githubToken: string;
    cfApiToken: string;
    cfAccountId: string;
}

/**
 * エラー監視に必要な3つのシークレットを解決する。1つでも未設定なら警告ログを
 * 出してnullを返す（呼び出し側でスキップする）。単純な`!x`のガード節を並べる
 * ことで複合条件（&&/||）を避けつつ、TypeScriptの型絞り込みも効かせている
 * （local/no-compound-condition対応）。
 *
 * `cfApiToken`は`CLOUDFLARE_ANALYTICS_API_TOKEN`（Account Analytics:Read限定の
 * fine-grainedトークン）のみを使う。デプロイ権限を持つトークンへのフォールバックは
 * 持たない（APIトークンのスコープ整理、フルパワーのデプロイ用トークンをWorker
 * ランタイムへ置かないため）。
 */
function resolveErrorMonitorSecrets(): ErrorMonitorSecrets | null {
    const githubToken = EnvStore.env.GITHUB_TOKEN;
    if (!githubToken) {
        appLogger.warn(
            '[errorMonitorCheck] GITHUB_TOKEN が未設定のためスキップします',
        );
        return null;
    }
    const cfApiToken = EnvStore.env.CLOUDFLARE_ANALYTICS_API_TOKEN;
    if (!cfApiToken) {
        appLogger.warn(
            '[errorMonitorCheck] CLOUDFLARE_ANALYTICS_API_TOKEN が未設定のためスキップします',
        );
        return null;
    }
    const cfAccountId = EnvStore.env.CLOUDFLARE_ACCOUNT_ID;
    if (!cfAccountId) {
        appLogger.warn(
            '[errorMonitorCheck] CLOUDFLARE_ACCOUNT_ID が未設定のためスキップします',
        );
        return null;
    }
    return { githubToken, cfApiToken, cfAccountId };
}

/**
 * エラー監視チェックを1回実行する。`GITHUB_TOKEN`・
 * `CLOUDFLARE_ANALYTICS_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`のいずれかが
 * 未設定の場合は何もせずスキップする（graceful degradation）。
 * 1対象のチェックが失敗しても他対象のチェックは継続する
 * （error-monitor.ymlのサブシェル隔離と同じ設計方針）。
 * @param now - 基準時刻（UTC、テスト容易性のため注入可能にしている）
 * @param targets - チェック対象キーの配列（既定: 全5Worker。OBS-012相当の
 *   apiのみ追加チェックでは`['api']`を渡す）
 */
export async function runErrorMonitorCheck(
    now: Date,
    targets: string[] = ALL_ERROR_MONITOR_TARGETS,
): Promise<void> {
    const secrets = resolveErrorMonitorSecrets();
    if (!secrets) {
        return;
    }

    const gateway = new GithubIssueGateway('race-schedule-api');

    for (const targetKey of targets) {
        const scriptName = TARGET_SCRIPT_NAMES[targetKey];
        if (!scriptName) {
            appLogger.warn(
                `[errorMonitorCheck] 未知の監視対象キーです: ${targetKey}`,
            );
            continue;
        }
        try {
            await checkOneTarget(
                targetKey,
                scriptName,
                secrets.cfApiToken,
                secrets.cfAccountId,
                now,
                gateway,
                secrets.githubToken,
            );
        } catch (error) {
            appLogger.warn(
                `[errorMonitorCheck] ${targetKey} のチェックに失敗しました`,
                error,
            );
        }
    }
}
