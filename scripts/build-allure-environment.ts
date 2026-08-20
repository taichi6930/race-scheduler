#!/usr/bin/env bun
/**
 * build-allure-environment.ts
 *
 * Allure の Overview タブにある Environment ウィジェットは、結果ディレクトリ直下の
 * `environment.properties`（`Key=Value` 形式）が無いと空のまま表示される。
 * `allure-commandline generate` の直前に実行し、`test-report/allure-results/environment.properties`
 * を書き出す。GitHub Actions 環境変数が無い場合（ローカル実行時）はフォールバック値で
 * 生成し、`bun run allure:generate` がローカルでもクラッシュしないようにする
 * （`build-allure-executor.ts` と同じ方針）。
 *
 * 使い方:
 *   bun scripts/build-allure-environment.ts
 */

import { writeFileSync } from 'node:fs';
import { platform, release } from 'node:os';

const OUTPUT_PATH = 'test-report/allure-results/environment.properties';
const NODE_TARGET = '24';

const escapePropertyValue = (value: string): string =>
    value.replace(/[\r\n]/g, ' ');

/**
 * GitHub Actions 環境変数から environment.properties の内容を組み立てる。
 * 環境変数が無い（ローカル実行）場合は `os` モジュールからの実測値にフォールバックする。
 */
const buildProperties = (env: NodeJS.ProcessEnv) =>
    ({
        'Bun.Version': Bun.version,
        'Node.Target': NODE_TARGET,
        OS: env.RUNNER_OS ?? `${platform()} ${release()}`,
        Branch: env.GITHUB_REF_NAME ?? '(local)',
        Commit: env.GITHUB_SHA?.slice(0, 12) ?? '(local)',
        Layers: 'ut, component, sit, uat',
    }) satisfies Record<string, string>;

function main(): void {
    const properties = buildProperties(process.env);
    const body = `${Object.entries(properties)
        .map(([key, value]) => `${key}=${escapePropertyValue(value)}`)
        .join('\n')}\n`;
    writeFileSync(OUTPUT_PATH, body);
    console.log(`✅ ${OUTPUT_PATH} を生成しました`);
}

if (import.meta.main) {
    main();
}

export { buildProperties };
