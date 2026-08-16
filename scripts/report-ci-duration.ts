#!/usr/bin/env bun
/**
 * report-ci-duration.ts
 *
 * `pull_request.yml` の直近実行についてジョブ別所要時間（平均・最大）を集計し、
 * Markdownサマリーを標準出力に出す（CICD-54）。CICD-09〜53の「削減見込み」を
 * 継続的に検証するための計測基盤。GitHub Actionsの $GITHUB_STEP_SUMMARY への
 * リダイレクトを想定している。
 *
 * 使い方:
 *   GH_TOKEN=... GH_REPO=owner/repo bun scripts/report-ci-duration.ts [--runs=20]
 */

/* eslint-disable no-console */
import {
    fetchJobTimings,
    fetchRecentRunIds,
    groupByJobName,
    type JobTiming,
    totalBillableMinutes,
} from './lib/ciDuration';

const WORKFLOW_FILE = 'pull_request.yml';

const parseRunCount = (argv: string[]): number => {
    const arg = argv.find((a) => a.startsWith('--runs='));
    return arg ? Number(arg.split('=')[1]) : 20;
};

/** サマリーに表示するジョブ数（TOK-093: 出力行数削減のため上位5件に限定） */
const TOP_SLOW_JOBS_COUNT = 5;

const buildSummary = (allTimings: JobTiming[][]): string => {
    const byJob = groupByJobName(allTimings);
    const rows = [...byJob.entries()]
        .map(([name, durations]) => ({
            name,
            count: durations.length,
            avg: durations.reduce((a, b) => a + b, 0) / durations.length,
            max: Math.max(...durations),
        }))
        .sort((a, b) => b.avg - a.avg);
    const topRows = rows.slice(0, TOP_SLOW_JOBS_COUNT);

    // CICD-72対応: G-4調査で使った「ジョブ単位で最低1分に切り上げ課金」ルールに基づく
    // Actions分数消費の推計を追加し、CICD-69/70等の削減効果を継続的に確認できるようにする。
    const totalMinutes = totalBillableMinutes(allTimings);
    const avgMinutesPerRun = totalMinutes / allTimings.length;

    return [
        `## CI所要時間レポート（pull_request.yml 直近実行、遅い上位${TOP_SLOW_JOBS_COUNT}ジョブ）`,
        '',
        `分析対象: 直近${allTimings.length}回実行、推定Actions分数消費 合計${totalMinutes}分（1回あたり平均${avgMinutesPerRun.toFixed(1)}分、ジョブ単位で最低1分に切り上げる課金ルールに基づく推計）`,
        '',
        '| ジョブ | 実行回数 | 平均秒数 | 最大秒数 |',
        '| --- | --- | --- | --- |',
        ...topRows.map(
            (r) =>
                `| ${r.name} | ${r.count} | ${r.avg.toFixed(1)} | ${r.max.toFixed(1)} |`,
        ),
    ].join('\n');
};

const main = (): void => {
    const repo = process.env.GH_REPO;
    if (!repo) {
        throw new Error('GH_REPO環境変数が必要です（例: owner/repo）');
    }
    const runCount = parseRunCount(process.argv.slice(2));
    const runIds = fetchRecentRunIds(repo, WORKFLOW_FILE, runCount);
    const allTimings = runIds.map((id) => fetchJobTimings(repo, id));
    console.log(buildSummary(allTimings));
};

main();
