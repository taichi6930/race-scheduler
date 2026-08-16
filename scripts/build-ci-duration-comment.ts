#!/usr/bin/env bun
/**
 * build-ci-duration-comment.ts
 *
 * `pull_request.yml` の「今回のPR実行」のジョブ別所要時間を、直近の完了済み
 * 実行（ベースライン）の平均と比較し、Markdownコメント本文を組み立てる
 * （CICD-55）。CICD-54（週次サマリー）は「傾向を後から確認する」ためのものだが、
 * こちらはPRのその場でCI回帰（新しいジョブが遅くなった等）に気づけるようにする。
 *
 * 使い方:
 *   GH_TOKEN=... GH_REPO=owner/repo bun scripts/build-ci-duration-comment.ts \
 *     --run-id=123456 [--baseline-samples=10]
 *
 * `--run-id` は今回のPR実行自身のworkflow run ID（`${{ github.run_id }}`）。
 * ベースラインはこのrunを除いた直近 `--baseline-samples` 件の完了済み実行から
 * 算出する（過去のCI高速化タスクの効果測定と同じ考え方）。
 */

/* eslint-disable no-console */
import {
    durationSeconds,
    excludeSkipped,
    fetchJobTimings,
    fetchRecentRunIds,
    groupByJobName,
    type JobTiming,
} from './lib/ciDuration';

const WORKFLOW_FILE = 'pull_request.yml';

/** ベースライン比でこの秒数以上「かつ」この倍率以上遅くなった場合に警告フラグを立てる */
const REGRESSION_ABSOLUTE_THRESHOLD_SECONDS = 15;
const REGRESSION_RATIO_THRESHOLD = 1.3;

export interface CliOptions {
    runId: number;
    baselineSamples: number;
}

/**
 * コマンドライン引数を解析する。
 * @param argv - `process.argv.slice(2)` で得られる引数一覧
 * @returns 解析済みオプション
 */
export const parseArgs = (argv: string[]): CliOptions => {
    const runIdArg = argv.find((a) => a.startsWith('--run-id='));
    const sampleArg = argv.find((a) => a.startsWith('--baseline-samples='));
    if (!runIdArg) {
        throw new Error('--run-id=<workflow run id> が必要です');
    }
    return {
        runId: Number(runIdArg.split('=')[1]),
        baselineSamples: sampleArg ? Number(sampleArg.split('=')[1]) : 10,
    };
};

/**
 * 直近の完了済み実行（今回のrunを除く）から、ジョブ名ごとの平均所要時間（秒）を算出する。
 * @param repo - `owner/repo` 形式のリポジトリ名
 * @param currentRunId - 今回のPR実行のrun ID（ベースラインから除外する）
 * @param sampleSize - ベースラインに使うrun数
 * @returns ジョブ名 → 平均所要時間（秒） のマップ
 */
const computeBaselineAverages = (
    repo: string,
    currentRunId: number,
    sampleSize: number,
): Map<string, number> => {
    const runIds = fetchRecentRunIds(repo, WORKFLOW_FILE, sampleSize + 1)
        .filter((id) => id !== currentRunId)
        .slice(0, sampleSize);
    const allTimings = runIds.map((id) => fetchJobTimings(repo, id));
    const byJob = groupByJobName(allTimings);

    const averages = new Map<string, number>();
    for (const [name, durations] of byJob) {
        averages.set(
            name,
            durations.reduce((a, b) => a + b, 0) / durations.length,
        );
    }
    return averages;
};

/** 1ジョブ分の比較結果 */
export interface ComparisonRow {
    name: string;
    current: number;
    baseline?: number;
    delta?: number;
    isRegression: boolean;
}

/**
 * ベースライン比で「明確に遅くなった」と判定する。
 * 秒数閾値・倍率閾値の両方を満たす場合のみ警告する（短時間ジョブの誤差による
 * 過剰検知を避けるため、絶対値・相対値の両方で条件を課す）。
 * @param current - 今回の所要時間（秒）
 * @param baseline - ベースライン平均（秒）
 * @returns 回帰と判定する場合 true
 */
const isRegression = (current: number, baseline: number): boolean =>
    current - baseline >= REGRESSION_ABSOLUTE_THRESHOLD_SECONDS &&
    current >= baseline * REGRESSION_RATIO_THRESHOLD;

/**
 * 今回の実行結果とベースラインを突き合わせ、比較行の一覧を組み立てる。
 * @param currentTimings - 今回の実行のジョブ別開始・終了時刻
 * @param baseline - ジョブ名 → ベースライン平均秒数
 * @returns 所要時間降順の比較行一覧
 */
export const buildComparisonRows = (
    currentTimings: JobTiming[],
    baseline: Map<string, number>,
): ComparisonRow[] =>
    currentTimings
        .map((job) => {
            const current = durationSeconds(job);
            const jobBaseline = baseline.get(job.name);
            const delta =
                jobBaseline === undefined ? undefined : current - jobBaseline;
            return {
                name: job.name,
                current,
                baseline: jobBaseline,
                delta,
                isRegression:
                    jobBaseline !== undefined &&
                    isRegression(current, jobBaseline),
            };
        })
        .sort((a, b) => b.current - a.current);

/**
 * 比較行一覧からMarkdownコメント本文を組み立てる。
 * @param rows - `buildComparisonRows` の結果
 * @param baselineSamples - ベースライン算出に使ったrun数
 * @returns PRコメント用Markdown
 */
export const buildComment = (
    rows: ComparisonRow[],
    baselineSamples: number,
): string => {
    const regressions = rows.filter((r) => r.isRegression);
    const banner =
        regressions.length > 0
            ? `⚠️ ${regressions.length}件のジョブが直近平均より明確に遅くなっています（+${REGRESSION_ABSOLUTE_THRESHOLD_SECONDS}秒以上 かつ ${REGRESSION_RATIO_THRESHOLD}倍以上）。`
            : '✅ 直近平均と比べて明確な回帰は検出されませんでした。';

    const tableRows = rows.map((r) => {
        const baselineText =
            r.baseline === undefined ? '—' : r.baseline.toFixed(1);
        const deltaText =
            r.delta === undefined
                ? '—'
                : `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)}`;
        const flag = r.isRegression ? ' ⚠️' : '';
        return `| ${r.name} | ${r.current.toFixed(1)} | ${baselineText} | ${deltaText}${flag} |`;
    });

    return [
        '## CI所要時間レポート（このPR実行 vs 直近平均）',
        '',
        banner,
        '',
        `直近${baselineSamples}回の完了済み実行（このrunを除く）の平均と比較しています。`,
        '',
        '| ジョブ | 今回(秒) | 直近平均(秒) | 差分(秒) |',
        '| --- | --- | --- | --- |',
        ...tableRows,
        '',
        '_このコメントは `.github/workflows/pull_request.yml` の `call-ci-duration-comment` ジョブにより自動更新されます（CICD-55）。_',
    ].join('\n');
};

/**
 * まだ完了していないジョブ（`completed_at` が null、例えばこのコメント投稿
 * ジョブ自身）を除外する。`new Date(null)` は 1970-01-01 に解決されてしまい、
 * 所要時間計算が破綻するため、完了済みジョブのみを対象にする。
 * @param timings - フィルタ対象のジョブ一覧
 * @returns 完了済みジョブのみの一覧
 */
export const onlyCompleted = (timings: JobTiming[]): JobTiming[] =>
    timings.filter((job) => Boolean(job.completed_at));

/**
 * GitHub API呼び出し失敗時の代替コメント本文を組み立てる。
 * このジョブは情報提供のみが目的（非ブロッキング）のため、`gh api`呼び出しが
 * 失敗した場合でもジョブ自体を失敗させず、理由を明記した代替コメントで
 * 常態を伝える。
 * @param reason - 失敗理由（エラーメッセージ）
 * @returns PRコメント用Markdown
 */
export const buildDegradedComment = (reason: string): string =>
    [
        '## CI所要時間レポート（このPR実行 vs 直近平均）',
        '',
        `⚠️ 所要時間データの取得に失敗したため、今回はレポートを生成できませんでした（${reason}）。`,
        '',
        '_このコメントは `.github/workflows/pull_request.yml` の `call-ci-duration-comment` ジョブにより自動更新されます（CICD-55）。_',
    ].join('\n');

const main = (): void => {
    const repo = process.env.GH_REPO;
    if (!repo) {
        throw new Error('GH_REPO環境変数が必要です（例: owner/repo）');
    }
    const { runId, baselineSamples } = parseArgs(process.argv.slice(2));

    try {
        const currentTimings = excludeSkipped(
            onlyCompleted(fetchJobTimings(repo, runId)),
        );
        const baseline = computeBaselineAverages(repo, runId, baselineSamples);
        const rows = buildComparisonRows(currentTimings, baseline);

        console.log(buildComment(rows, baselineSamples));
    } catch (error) {
        // GitHub API呼び出し（`gh api`経由）は権限設定やAPIの一時的な問題で
        // 失敗しうる。本ジョブは情報提供のみが目的のため、失敗してもPR全体を
        // ブロックしないよう代替コメントを出してジョブ自体は正常終了させる。
        const reason = error instanceof Error ? error.message : String(error);
        console.error('CI所要時間データの取得に失敗しました:', reason);
        console.log(buildDegradedComment(reason));
    }
};

if (import.meta.main) {
    main();
}
