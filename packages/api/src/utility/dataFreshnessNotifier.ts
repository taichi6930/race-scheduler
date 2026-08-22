/**
 * 本番データ鮮度チェック（CICD-121: health-check-data-freshness.ymlの
 * Worker側移行）の通知ロジック。
 *
 * バッチが「success」で終わっているのに実際は何も書き込んでいない、という
 * サイレント失敗（2026-07-18〜07-22に実際に発生し、4日間検知されなかった）を
 * 検知するための仕組み。全レース種別合計で0件（＝直近のバッチが機能していない
 * 強い兆候）であればGitHub Issueを作成し、復旧すればCloseする。
 *
 * 元はGitHub Actions（health-check-data-freshness.yml）が1日1回ポーリングして
 * いたが、api Worker自身が既にWeb Push配信用のscheduledハンドラ（毎分実行）を
 * 持つため、同じ仕組みに相乗りさせてGitHub Actions分数を丸ごと不要にする
 * （BACKLOG.md CICD-121）。GitHub Actions側のワークフローは並行稼働の確認が
 * とれるまで維持し、確認後に別途scheduleトリガーのみを削除する。
 *
 * `GITHUB_TOKEN`が未設定の場合は何もせずスキップする（graceful degradation。
 * `githubMasterIssueNotifier.ts`と同じ方針）。
 *
 * Issue検索→復旧/異常分岐→addComment/createIssue/closeIssueという制御フロー自体は
 * `errorMonitorNotifier.ts`/`uptimeCheckNotifier.ts`と同型のため`@race-schedule/core`の
 * `syncGithubIssueByCondition`に共通化している（QRUN-01: batchからも使えるよう core へ移設済み）。
 */

import type { IGithubIssueGateway } from '@race-schedule/core';
import { syncGithubIssueByCondition } from '@race-schedule/core';

/**
 * 鮮度チェックIssueのタイトル（Issue検索・新規作成の両方でキーとして使う）。
 * `githubMasterIssueNotifier.ts`と同じく、日付を含まない固定タイトルにして
 * 複数日にまたがっても同一Issueを検索できるようにしている（元のGitHub Actions版は
 * タイトルに日付を含めていたが、代わりにラベルで検索していた。ここではタイトルを
 * 固定にすることで、このリポジトリの他の通知機能と同じ「固定タイトルでの検索」
 * 方式に統一する）。
 */
export const DATA_FRESHNESS_ISSUE_TITLE =
    '[Health Check] 本番データが更新されていない疑い';

/** データ鮮度チェックの1回分の結果 */
export interface DataFreshnessCheckResult {
    /** チェック対象日（JST、YYYY-MM-DD） */
    checkDateJst: string;
    /** 対象日の全レース種別合計のレース数 */
    raceCount: number;
}

/**
 * 異常検知時のIssue本文を組み立てる。
 * @param checkDateJst - チェック対象日（JST）
 */
function buildAlertBody(checkDateJst: string): string {
    return `## 本番データの鮮度チェックで異常を検知しました

- 確認日: ${checkDateJst} (JST)
- 全レース種別（JRA/NAR/KEIRIN/AUTORACE/BOATRACE/OVERSEAS）合計のレース数: **0件**

全レース種別が同時に0件になることは通常運用ではまず起こらないため、
直近のバッチ処理（\`batch-all.yml\`）が正しく機能していない可能性が
あります。

過去に、CIジョブ自体は「success」で終わるのに実際は何も書き込んでいない
サイレント失敗が発生したことがあります（2026-07-18〜07-22）。まずは
\`batch-all.yml\` の直近の実行ログを確認し、実際にレースデータの
取得・登録処理が動いているか確認してください。

_このIssueは api Worker の scheduled ハンドラ（データ鮮度チェック、CICD-121）により自動作成されました。_`;
}

/**
 * 復旧確認時のコメント本文を組み立てる。
 * @param checkDateJst - チェック対象日（JST）
 * @param raceCount - 確認できたレース数
 */
function buildRecoveryComment(checkDateJst: string, raceCount: number): string {
    return `本日（${checkDateJst} JST）は全レース種別合計 ${raceCount} 件のレースが確認できたため、自動的にCloseします。再発した場合は新しいIssueが作成されます。`;
}

/**
 * データ鮮度チェックの結果をGitHub Issueへ同期する（作成・コメント追加・Close）。
 * @param result - データ鮮度チェックの結果
 * @param gateway - GitHub Issues ゲートウェイ
 * @param token - GitHub API トークン
 */
export async function syncDataFreshnessIssue(
    result: DataFreshnessCheckResult,
    gateway: IGithubIssueGateway,
    token: string,
): Promise<void> {
    return syncGithubIssueByCondition(result, gateway, token, {
        logPrefix: '[dataFreshnessNotifier]',
        title: () => DATA_FRESHNESS_ISSUE_TITLE,
        isRecovered: (r) => r.raceCount > 0,
        keyPrefix: () => '',
        noOpReason: (r) => `正常（${r.raceCount}件）`,
        recoveredReason: () => 'データ更新を確認し',
        buildAlertBody: (r) => buildAlertBody(r.checkDateJst),
        buildRecoveryComment: (r) =>
            buildRecoveryComment(r.checkDateJst, r.raceCount),
    });
}
