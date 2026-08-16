#!/usr/bin/env bun
/**
 * build-allure-executor.ts
 *
 * Allure の History タブが各エントリを「unknown at unknown」としか表示しない
 * 問題への対応。Allure は `executor.json`（ビルド名・URL・実行時刻等のメタデータ）
 * が入力ディレクトリに存在しないと、履歴の各ビルドをこの名前で表示する仕様のため、
 * `test-report.yml` が前回の history/*.json を取得する処理はあっても
 * executor.json 自体を生成していなかったのが原因だった。
 *
 * `allure-commandline generate` の直前に実行し、`test-report/allure-results/executor.json`
 * を書き出す。GitHub Actions 環境変数が無い場合（ローカル実行時）はフォールバック値で
 * 生成し、`bun run allure:generate` がローカルでもクラッシュしないようにする。
 *
 * 使い方:
 *   bun scripts/build-allure-executor.ts
 */

import { writeFileSync } from 'node:fs';

interface AllureExecutor {
    name: string;
    type: string;
    buildOrder: number;
    buildName: string;
    buildUrl: string;
    reportUrl: string;
    reportName: string;
}

const OUTPUT_PATH = 'test-report/allure-results/executor.json';
// CICD-71対応（2026-08-01）: GitHub Pages（publicリポジトリでのみ無料）から
// Cloudflare Pagesへ公開先を移行した。プロジェクト名は
// `.github/workflows/test-report.yml`の`wrangler pages deploy`と一致させること。
const REPORT_URL = 'https://race-schedule-ci-report.pages.dev/allure/';

/**
 * GitHub Actions 環境変数から executor 情報を組み立てる。
 * 環境変数が無い（ローカル実行）場合はフォールバック値を返す。
 */
function buildExecutor(env: NodeJS.ProcessEnv): AllureExecutor {
    const runId = env.GITHUB_RUN_ID;
    const runNumber = env.GITHUB_RUN_NUMBER;
    const repository = env.GITHUB_REPOSITORY;
    const serverUrl = env.GITHUB_SERVER_URL ?? 'https://github.com';

    if (!runId || !runNumber || !repository) {
        return {
            name: 'Local',
            type: 'local',
            buildOrder: 0,
            buildName: 'local run',
            buildUrl: '',
            reportUrl: REPORT_URL,
            reportName: 'Allure Report',
        };
    }

    return {
        name: 'GitHub Actions',
        type: 'github',
        buildOrder: Number(runNumber),
        buildName: `#${runNumber}`,
        buildUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
        reportUrl: REPORT_URL,
        reportName: 'Allure Report',
    };
}

function main(): void {
    const executor = buildExecutor(process.env);
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(executor, null, 4)}\n`);
    console.log(
        `✅ ${OUTPUT_PATH} を生成しました（buildName: ${executor.buildName}）`,
    );
}

main();
