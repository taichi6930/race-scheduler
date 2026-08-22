/**
 * Cloudflareエラー監視（CICD-122: error-monitor.ymlのWorker側移行）の通知ロジック。
 *
 * Cloudflare Workers の GraphQL Analytics API (`workersInvocationsAdaptive`) から
 * 取得したWorker単位のエラー数を見て、1件以上あればGitHub Issueを作成し、
 * 0件（解消）になれば既存Issueをコメント後にCloseする。
 *
 * 元はGitHub Actions（error-monitor.yml）が1時間おき（apiのみ追加で30分おき）に
 * ポーリングしていたが、api Worker自身のscheduledハンドラに相乗りさせることで
 * GitHub Actions分数を丸ごと不要にする（BACKLOG.md CICD-122）。
 *
 * Worker単位で個別のIssueを作成するため、`dataFreshnessNotifier.ts`と異なり
 * タイトルはWorkerごとに変える（`[Cloudflare] ${scriptName} でエラーを検知`、
 * 旧GitHub Actions版と同じ文言にすることで、並行稼働期間中も同一Issueを
 * 引き継いで検索できるようにしている）。
 *
 * `GITHUB_TOKEN`が未設定の場合は何もせずスキップする（graceful degradation。
 * `dataFreshnessNotifier.ts`と同じ方針）。
 *
 * Issue検索→復旧/異常分岐→addComment/createIssue/closeIssueという制御フロー自体は
 * `dataFreshnessNotifier.ts`/`uptimeCheckNotifier.ts`と同型のため`@race-schedule/core`の
 * `syncGithubIssueByCondition`に共通化している（QRUN-01: batchからも使えるよう core へ移設済み）。
 */

import type { IGithubIssueGateway } from '@race-schedule/core';
import {
    syncGithubIssueByCondition,
    toJstISOString,
} from '@race-schedule/core';

/**
 * UTC ISO8601文字列をJST併記の表示用文字列に変換する（QJST-13）。
 * 運用者はJSTで追うため、UTC表記のみだと毎回+9時間の変換が必要だった。
 * @param iso - UTC ISO8601文字列
 */
function withJst(iso: string): string {
    return `${iso} (${toJstISOString(new Date(iso))} JST)`;
}

/** 1回分のエラー監視チェック結果。 */
export interface ErrorMonitorCheckResult {
    /** 監視対象キー（ログ用、例: 'api'） */
    targetKey: string;
    /** Cloudflare上のスクリプト名（例: 'race-schedule-prod'） */
    scriptName: string;
    /** 集計期間内のエラー数 */
    errorCount: number;
    /** 集計期間内のリクエスト数 */
    requestCount: number;
    /** 集計期間の開始時刻（ISO8601、UTC） */
    windowStartIso: string;
    /** 集計期間の終了時刻（ISO8601、UTC） */
    windowEndIso: string;
}

/**
 * 対象Workerのエラー監視Issueタイトル（Issue検索・新規作成の両方でキーとして使う）。
 * 元のGitHub Actions版（error-monitor.yml）と同一文言にしている。
 * @param scriptName - Cloudflare上のスクリプト名
 */
function issueTitleFor(scriptName: string): string {
    return `[Cloudflare] ${scriptName} でエラーを検知`;
}

/**
 * 異常検知時のIssue本文を組み立てる。
 * @param result
 */
function buildAlertBody(result: ErrorMonitorCheckResult): string {
    return `## Cloudflareでエラーを検知しました

- Worker: \`${result.scriptName}\`
- 期間: ${withJst(result.windowStartIso)} 〜 ${withJst(result.windowEndIso)}
- エラー数 / リクエスト数: ${result.errorCount} / ${result.requestCount}

エラーの詳細（メッセージ・スタックトレース）は Cloudflare ダッシュボードの Workers Logs から \`${result.scriptName}\` を確認してください。このIssueはエラー件数の検知のみで、詳細内容は含みません。
エラーが止まれば次回チェック時に自動でCloseされます。

_このIssueは api Worker の scheduled ハンドラ（Cloudflareエラー監視、CICD-122）により自動作成されました。_`;
}

/**
 * 復旧確認時のコメント本文を組み立てる。
 * @param result
 */
function buildRecoveryComment(result: ErrorMonitorCheckResult): string {
    return `直近1時間（${withJst(result.windowStartIso)} 〜 ${withJst(result.windowEndIso)}）はエラーが検知されなかったため、自動的にCloseします。再発した場合は新しいIssueが作成されます。`;
}

/**
 * エラー監視チェックの結果をGitHub Issueへ同期する（作成・コメント追加・Close）。
 * @param result - エラー監視チェックの結果
 * @param gateway - GitHub Issues ゲートウェイ
 * @param token - GitHub API トークン
 */
export async function syncErrorMonitorIssue(
    result: ErrorMonitorCheckResult,
    gateway: IGithubIssueGateway,
    token: string,
): Promise<void> {
    return syncGithubIssueByCondition(result, gateway, token, {
        logPrefix: '[errorMonitorNotifier]',
        title: (r) => issueTitleFor(r.scriptName),
        isRecovered: (r) => r.errorCount === 0,
        keyPrefix: (r) => `${r.targetKey}: `,
        noOpReason: () => 'エラーなし',
        recoveredReason: () => 'エラー解消を確認し',
        buildAlertBody,
        buildRecoveryComment,
    });
}
