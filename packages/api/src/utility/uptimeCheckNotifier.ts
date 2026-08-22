/**
 * Uptime監視（uptime-check.ymlのWorker側移行）の通知ロジック。
 *
 * 各Worker（api/admin/batch/calendar/scraping）の`/health`エンドポイントへの疎通結果を
 * 見て、失敗（200以外・タイムアウト）が1件でもあればGitHub Issueを作成し、
 * 復旧（200）すれば既存Issueをコメント後にCloseする。
 *
 * 元はGitHub Actions（uptime-check.yml）が15分おきにポーリングしていたが、
 * api Worker自身のscheduledハンドラに相乗りさせることでGitHub Actions分数を
 * 丸ごと不要にする。
 *
 * `errorMonitorNotifier.ts`と同じくWorker単位で固定タイトルのIssueを使う
 * （元のGitHub Actions版はタイトルにHTTPステータスを含めていたが、タイトルを
 * dedupキーとして使う都合上、ここでは固定文言にしてステータスは本文側に書く）。
 *
 * `GITHUB_TOKEN`が未設定の場合は何もせずスキップする（graceful degradation。
 * `dataFreshnessNotifier.ts`と同じ方針）。
 *
 * Issue検索→復旧/異常分岐→addComment/createIssue/closeIssueという制御フロー自体は
 * `dataFreshnessNotifier.ts`/`errorMonitorNotifier.ts`と同型のため`@race-schedule/core`の
 * `syncGithubIssueByCondition`に共通化している（QRUN-01: batchからも使えるよう core へ移設済み）。
 */

import type { IGithubIssueGateway } from '@race-schedule/core';
import { syncGithubIssueByCondition } from '@race-schedule/core';

/** 1回分のUptimeチェック結果。 */
export interface UptimeCheckResult {
    /** 監視対象キー（例: 'api'） */
    targetKey: string;
    /** チェック対象URL */
    targetUrl: string;
    /** 疎通できたか（HTTP 200） */
    healthy: boolean;
    /** 実際のHTTPステータス（タイムアウト・接続失敗時は0） */
    httpStatus: number;
}

/**
 * 対象WorkerのUptime監視Issueタイトル（Issue検索・新規作成の両方でキーとして使う）。
 * @param targetKey - 監視対象キー
 */
function issueTitleFor(targetKey: string): string {
    return `[Uptime] ${targetKey} の /health 疎通に失敗`;
}

/**
 * 異常検知時のIssue本文を組み立てる。
 * @param result
 */
function buildAlertBody(result: UptimeCheckResult): string {
    return `## /health 疎通失敗を検知しました

- 対象: \`${result.targetKey}\`
- URL: ${result.targetUrl}
- HTTPステータス: ${result.httpStatus}（0はタイムアウト/接続失敗）

Workerがデプロイ後にクラッシュしている、またはCloudflare側で障害が発生している
可能性があります。Cloudflareダッシュボードで該当Workerの状態を確認してください。
復旧すれば次回チェック時に自動でCloseされます。

_このIssueは api Worker の scheduled ハンドラ（Uptime監視）により自動作成されました。_`;
}

/**
 * 復旧確認時のコメント本文を組み立てる。
 * @param result
 */
function buildRecoveryComment(result: UptimeCheckResult): string {
    return `\`${result.targetUrl}\` への疎通を確認できたため、自動的にCloseします。再発した場合は新しいIssueが作成されます。`;
}

/**
 * Uptimeチェックの結果をGitHub Issueへ同期する（作成・コメント追加・Close）。
 * @param result - Uptimeチェックの結果
 * @param gateway - GitHub Issues ゲートウェイ
 * @param token - GitHub API トークン
 */
export async function syncUptimeCheckIssue(
    result: UptimeCheckResult,
    gateway: IGithubIssueGateway,
    token: string,
): Promise<void> {
    return syncGithubIssueByCondition(result, gateway, token, {
        logPrefix: '[uptimeCheckNotifier]',
        title: (r) => issueTitleFor(r.targetKey),
        isRecovered: (r) => r.healthy,
        keyPrefix: (r) => `${r.targetKey}: `,
        noOpReason: () => '正常',
        recoveredReason: () => '復旧を確認し',
        buildAlertBody,
        buildRecoveryComment,
    });
}
