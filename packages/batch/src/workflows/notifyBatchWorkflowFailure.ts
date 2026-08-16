/**
 * Workflow失敗時のGitHub Issue通知（CICD-73/OBS-014）。
 *
 * `batch-all.yml`（GitHub Actions版）は元々raceType単位でGitHub Issueを起票していたが
 * （OBS-014）、Cloudflare Workflowsへの移行に伴い実行が非同期化し、GitHub Actions側
 * からは実際のバッチ処理結果が見えなくなった
 * （docs/tasks/cicd-73-batch-cron-migration.md §11-4の既知のトレードオフ）。
 * そのため、Workflow自身がこの通知の役割を引き継ぐ。
 *
 * api（データ鮮度チェック、`dataFreshnessNotifier.ts`）と同じ「固定タイトルの
 * Issueを検索→無ければ作成、あればコメント追加」パターンを踏襲する。
 *
 * `GITHUB_TOKEN`が未設定の場合は何もせずスキップする（graceful degradation、
 * `dataFreshnessNotifier.ts`と同じ方針）。
 */

import type { IGithubIssueGateway, RaceType } from '@race-schedule/core';
import { appLogger, EnvStore, toErrorMessage } from '@race-schedule/core';

import type { BatchExecTarget } from '../types';

/** batch Workflow失敗通知Issueのタイトル（検索・新規作成の両方でキーとして使う）。 */
export const BATCH_WORKFLOW_FAILURE_ISSUE_TITLE =
    '[Batch] Workflow実行で失敗が発生';

/**
 * batch Worker本番環境のCloudflareスクリプト名。
 * `errorMonitorCheck.ts`の`TARGET_SCRIPT_NAMES.batch`と同じ値（`wrangler.toml`の
 * `[env.production] name`）。このWorkflowは本番cronからのみ起動されるため
 * 固定値で問題ない。
 */
const BATCH_WORKER_SCRIPT_NAME = 'race-schedule-batch-prod';

/** 1件分の失敗情報（raceType×target単位、step.doのリトライ上限到達後）。 */
export interface BatchStepFailure {
    raceType: RaceType;
    target: BatchExecTarget;
    error: unknown;
}

/**
 * `CLOUDFLARE_ACCOUNT_ID`を読み取る（`errorMonitorCheck.ts`が使うものと同じ
 * 環境変数だが、batch Workerの実行時シークレットには2026-08-14時点で未登録の
 * ため通常は取得できない）。`EnvStore.setEnv`が未実行の呼び出し元（単体テスト等）
 * でも`buildFailureBody`が例外を投げないよう、未設定・未初期化のいずれもここで
 * 吸収してundefinedにフォールバックする。
 */
function resolveCloudflareAccountId(): string | undefined {
    try {
        return EnvStore.env.CLOUDFLARE_ACCOUNT_ID;
    } catch {
        return;
    }
}

/**
 * Cloudflare DashboardのWorkers Logs画面へのURLを組み立てる。
 * アカウントIDが取得できればそれを含む直接URLを、取得できなければ
 * アカウントIDを省いたURL（Dashboardがログイン中のアカウントへ
 * リダイレクトする）を返す。
 * @remarks Cloudflare DashboardのWorkers Logsは、特定の文字列（インスタンスID等）
 *   を検索条件としてURLへ埋め込むディープリンクをサポートしていないため、
 *   instanceIdはURLではなくリンクテキスト・Issue本文側で明示する
 *   （`buildFailureBody`参照）。
 */
function buildWorkersLogsUrl(): string {
    const accountId = resolveCloudflareAccountId();
    const accountSegment = accountId ? `${accountId}/` : '';
    return `https://dash.cloudflare.com/${accountSegment}workers/services/view/${BATCH_WORKER_SCRIPT_NAME}/production/observability/logs`;
}

/**
 * 通知Issue/コメントの本文を組み立てる。
 * @param failures - 失敗一覧（空でない前提、呼び出し側で保証）
 * @param instanceId - このWorkflowインスタンスのID（Workers Logsでの追跡用）
 */
function buildFailureBody(
    failures: readonly BatchStepFailure[],
    instanceId: string,
): string {
    const lines = failures.map(
        (failure) =>
            `- \`${failure.raceType}-${failure.target}\`: ${toErrorMessage(failure.error)}`,
    );
    const logsUrl = buildWorkersLogsUrl();
    return `## batch Workflow でバッチ処理が失敗しました

- Workflowインスタンス ID: \`${instanceId}\`
- 失敗した raceType×target（リトライ上限到達後）:
${lines.join('\n')}

[Cloudflare Workers Logsを開く](${logsUrl})し、インスタンス ID \`${instanceId}\` でログを検索してください。

_このIssueは packages/batch のWorkflow（\`runBatchAllWorkflow\`）により自動作成されました。次回の成功実行時は自動でCloseされません（手動で解消を確認しCloseしてください）。_`;
}

/**
 * Workflowで発生した失敗をGitHub Issueへ同期する（新規作成、または既存へコメント追加）。
 * 失敗しても例外を投げず警告ログのみ出力する（通知処理はベストエフォート、
 * `dataFreshnessNotifier.ts`の`syncDataFreshnessIssue`と同じ方針・シグネチャ形状）。
 * 空配列の場合は何もしない。
 * @param failures - 失敗一覧
 * @param instanceId - このWorkflowインスタンスのID
 * @param gateway - GitHub Issues ゲートウェイ
 * @param token - GitHub APIトークン
 */
export async function syncBatchWorkflowFailureIssue(
    failures: readonly BatchStepFailure[],
    instanceId: string,
    gateway: IGithubIssueGateway,
    token: string,
): Promise<void> {
    if (failures.length === 0) {
        return;
    }

    try {
        const issues = await gateway.fetchAllOpenIssues(token);
        const existing = issues.find(
            (issue) => issue.title === BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
        );
        const body = buildFailureBody(failures, instanceId);

        if (existing) {
            await gateway.addComment(token, existing.number, body);
            appLogger.info(
                `[notifyBatchWorkflowFailure] 既存Issue #${existing.number} にコメントを追加しました`,
            );
            return;
        }
        const issueNumber = await gateway.createIssue(
            token,
            BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
            body,
        );
        appLogger.info(
            `[notifyBatchWorkflowFailure] 新規Issueを作成しました: #${issueNumber}`,
        );
    } catch (error) {
        appLogger.warn(
            '[notifyBatchWorkflowFailure] 通知処理に失敗しました',
            error,
        );
    }
}
