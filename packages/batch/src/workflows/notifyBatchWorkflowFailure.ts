/**
 * Workflow失敗時のGitHub Issue通知（CICD-73/OBS-014）。
 *
 * `batch-all.yml`（GitHub Actions版）は元々raceType単位でGitHub Issueを起票していたが
 * （OBS-014）、Cloudflare Workflowsへの移行に伴い実行が非同期化し、GitHub Actions側
 * からは実際のバッチ処理結果が見えなくなった
 * （docs/tasks/cicd-73-batch-cron-migration.md §11-4の既知のトレードオフ）。
 * そのため、Workflow自身がこの通知の役割を引き継ぐ。
 *
 * api（データ鮮度チェック等）と同じ「固定タイトルのIssueを検索→異常なら無ければ
 * 作成・あればコメント追加、復旧なら既存Issueにコメント追加後Close」パターンを
 * `@race-schedule/core`の`syncGithubIssueByCondition`経由で踏襲する。
 *
 * @remarks QRUN-01: 以前は失敗が0件（＝成功）の場合に即returnし、既存の失敗Issueが
 *   残っていても自動Closeされなかった（他の監視系4系統との唯一の非対称点だった）。
 *   `syncGithubIssueByCondition`を使うことで、成功時にも同じタイトルの既存Issueを
 *   検索してCloseする経路が入り、非対称が解消された。
 *
 * `GITHUB_TOKEN`が未設定の場合は何もせずスキップする（graceful degradation、
 * `dataFreshnessNotifier.ts`と同じ方針）。
 */

import type { IGithubIssueGateway, RaceType } from '@race-schedule/core';
import {
    EnvStore,
    syncGithubIssueByCondition,
    toErrorMessage,
} from '@race-schedule/core';

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
 * 異常検知時のIssue本文を組み立てる。
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

_このIssueは packages/batch のWorkflow（\`runBatchAllWorkflow\`）により自動作成されました。次回の成功実行時は自動でCloseされます。_`;
}

/** 復旧確認時のコメント本文を組み立てる。 */
function buildRecoveryComment(): string {
    return 'batch Workflow が失敗なしで完了したため、自動的にCloseします。再発した場合は新しいIssueが作成されます。';
}

/** `syncGithubIssueByCondition` に渡す1回分の同期対象（失敗一覧＋このWorkflowインスタンスID）。 */
interface BatchWorkflowSyncTarget {
    failures: readonly BatchStepFailure[];
    instanceId: string;
}

/**
 * Workflowの実行結果（失敗一覧）をGitHub Issueへ同期する。
 * 失敗が1件以上あれば新規作成またはコメント追加、0件（＝成功）なら既存Issueが
 * あればコメント追加後にCloseする（QRUN-01）。
 * 失敗しても例外を投げず警告ログのみ出力する（通知処理はベストエフォート）。
 * @param failures - 失敗一覧（空配列＝成功）
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
    await syncGithubIssueByCondition<BatchWorkflowSyncTarget>(
        { failures, instanceId },
        gateway,
        token,
        {
            logPrefix: '[notifyBatchWorkflowFailure]',
            title: () => BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
            isRecovered: (target) => target.failures.length === 0,
            keyPrefix: () => '',
            noOpReason: () => '失敗なしで完了',
            recoveredReason: () => '失敗なしで完了し',
            buildAlertBody: (target) =>
                buildFailureBody(target.failures, target.instanceId),
            buildRecoveryComment: () => buildRecoveryComment(),
        },
    );
}
