/**
 * @file CI ジョブ所要時間の取得・集計に関する共通ヘルパー（CICD-54/55）
 *
 * `report-ci-duration.ts`（週次サマリー）と `build-ci-duration-comment.ts`
 * （PRコメントでの回帰検知、CICD-55）の両方から使う `gh api` 呼び出し・
 * 集計ロジックを共通化する。
 */

import { execFileSync } from 'node:child_process';

/**
 * 1ジョブ分の開始・終了時刻。
 * `completed_at` はジョブが未完了（実行中）の間は GitHub API 上 null になりうる
 * （{@link onlyCompleted} で除外してから {@link durationSeconds} 等に渡すこと）。
 */
export interface JobTiming {
    name: string;
    started_at: string;
    completed_at: string | null;
    conclusion: string | null;
}

/** {@link onlyCompleted} で絞り込み済みの、必ず完了しているジョブ。 */
export interface CompletedJobTiming extends JobTiming {
    completed_at: string;
}

/**
 * まだ完了していないジョブ（`completed_at` が null、例えば実行中のジョブ自身）を除外する。
 * `new Date(null)` は 1970-01-01 に解決されてしまい、所要時間計算が破綻するため、
 * {@link durationSeconds} を呼ぶ前に必ずこのフィルタを通す。
 * @param timings - フィルタ対象のジョブ一覧
 * @returns 完了済みジョブのみの一覧
 */
export const onlyCompleted = (timings: JobTiming[]): CompletedJobTiming[] =>
    timings.filter(
        (job): job is CompletedJobTiming => job.completed_at !== null,
    );

/**
 * `gh api` を実行し、標準出力を文字列で返す。
 * @param args - `gh api` に渡す引数
 * @returns コマンドの標準出力
 */
export const runGhApi = (args: string[]): string =>
    execFileSync('gh', ['api', ...args], { encoding: 'utf-8' });

/**
 * `fetchRecentRunIds` が `gh api` に渡す引数を組み立てる（テスト容易性のため分離）。
 * `-f`（フィールド）を付けると `gh api` は明示的に `--method GET` を指定しない限り
 * POSTをデフォルトにするため、GETしか受け付けないこのエンドポイント（list workflow
 * runs）に対してPOSTを送ってしまい404になる。`-X GET` で明示する。
 * @param repo - `owner/repo` 形式のリポジトリ名
 * @param workflowFile - 対象ワークフローファイル名（例: `pull_request.yml`）
 * @param count - 取得件数
 * @returns `gh api` に渡す引数配列
 */
export const buildRecentRunsArgs = (
    repo: string,
    workflowFile: string,
    count: number,
): string[] => [
    `repos/${repo}/actions/workflows/${workflowFile}/runs`,
    '-X',
    'GET',
    '-f',
    'status=completed',
    '-f',
    `per_page=${count}`,
    '--jq',
    '.workflow_runs[].id',
];

/**
 * 指定ワークフローの直近の完了済みworkflow run IDを新しい順に取得する。
 * @param repo - `owner/repo` 形式のリポジトリ名
 * @param workflowFile - 対象ワークフローファイル名（例: `pull_request.yml`）
 * @param count - 取得件数
 * @returns run ID の配列（新しい順）
 */
export const fetchRecentRunIds = (
    repo: string,
    workflowFile: string,
    count: number,
): number[] => {
    const output = runGhApi(buildRecentRunsArgs(repo, workflowFile, count));
    return output.trim().split('\n').filter(Boolean).map(Number);
};

/**
 * 1つのrunに含まれる各ジョブの開始・終了時刻を取得する。
 * @param repo - `owner/repo` 形式のリポジトリ名
 * @param runId - 対象のworkflow run ID
 * @returns ジョブごとの開始・終了時刻一覧
 */
export const fetchJobTimings = (repo: string, runId: number): JobTiming[] => {
    const output = runGhApi([
        `repos/${repo}/actions/runs/${runId}/jobs`,
        '--jq',
        '.jobs[] | {name, started_at, completed_at, conclusion}',
    ]);
    // SAFETY: 直前の --jq フィルタで `{name, started_at, completed_at, conclusion}` の
    // 形状に絞って出力させているため、各行のJSON.parse結果はJobTimingの形状と一致する
    return output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as JobTiming);
};

/**
 * 1ジョブの実行時間（秒）を計算する。
 * @param job - 対象ジョブの開始・終了時刻
 * @returns 実行時間（秒）
 */
export const durationSeconds = (job: CompletedJobTiming): number =>
    (new Date(job.completed_at).getTime() -
        new Date(job.started_at).getTime()) /
    1000;

/**
 * GitHub Actionsのジョブ単位課金（最低1分に切り上げ）を反映した、
 * 1ジョブあたりの課金対象分数を計算する（CICD-72、G-4の見積もりと同じ計算式）。
 * @param seconds - ジョブの実行時間（秒）
 * @returns 課金対象の分数（切り上げ）
 */
export const billableMinutes = (seconds: number): number =>
    Math.ceil(seconds / 60);

/**
 * 複数run分のジョブ一覧全体で消費したActions分数の合計を推計する（CICD-72）。
 * 実測ではなく「ジョブ単位で最低1分に切り上げ」ルールに基づく静的な見積もり。
 * @param allTimings - run単位のジョブ一覧（外側の配列が各run）
 * @returns 課金対象分数の合計
 */
export const totalBillableMinutes = (allTimings: JobTiming[][]): number =>
    allTimings.reduce(
        (sum, timings) =>
            sum +
            onlyCompleted(timings).reduce(
                (jobSum, job) => jobSum + billableMinutes(durationSeconds(job)),
                0,
            ),
        0,
    );

/**
 * `if:` 条件で実行されなかったジョブ（`conclusion === 'skipped'`）を除外する。
 * skippedジョブは`completed_at - started_at`がほぼ0秒になるため、条件付きジョブ
 * （`call-workflow-hygiene-check`等、対象パス変更時のみ実行される）の平均所要時間に
 * 混ざると、実際に実行された回だけを比較すべきベースラインが不当に0秒付近へ
 * 引き下げられ、実行されただけのPRが「回帰」と誤検知される（2026-08-14）。
 * @param timings - フィルタ対象のジョブ一覧
 * @returns skippedを除いたジョブ一覧
 */
export const excludeSkipped = <T extends JobTiming>(timings: T[]): T[] =>
    timings.filter((job) => job.conclusion !== 'skipped');

/**
 * 複数run分のジョブ一覧を、ジョブ名ごとに実行時間（秒）のリストへグルーピングする。
 * 未完了ジョブは除外し（{@link onlyCompleted}）、skippedジョブは平均を歪めるため
 * 集計対象から除く（{@link excludeSkipped}）。
 * @param allTimings - run単位のジョブ一覧（外側の配列が各run）
 * @returns ジョブ名 → 実行時間（秒）配列 のマップ
 */
export const groupByJobName = (
    allTimings: JobTiming[][],
): Map<string, number[]> => {
    const byJob = new Map<string, number[]>();
    for (const timings of allTimings) {
        for (const job of excludeSkipped(onlyCompleted(timings))) {
            const list = byJob.get(job.name) ?? [];
            list.push(durationSeconds(job));
            byJob.set(job.name, list);
        }
    }
    return byJob;
};
