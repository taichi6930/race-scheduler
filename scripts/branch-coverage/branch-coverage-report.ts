#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
/**
 * @file 分岐カバレッジ（C1）レポート生成CLI
 *
 * branchInstrumentPlugin.ts が出力した istanbul 標準形式のカバレッジJSON
 * （coverage/istanbul-coverage.json）から、lcov + html レポートを生成し、
 * ファイル単位の分岐網羅率をコンソールにも表示する。非ブロッキング（exit codeは常に0）。
 *
 * 使い方: bun scripts/branch-coverage/branch-coverage-report.ts
 *   （`bun run test:branch-coverage` の一部として呼ばれる）
 */
import { createCoverageMap } from 'istanbul-lib-coverage';
import { createContext } from 'istanbul-lib-report';
import { create as createReporter } from 'istanbul-reports';

const COVERAGE_JSON_PATH = './coverage/istanbul-coverage.json';
const REPORT_DIR = './coverage/branch-html';

const main = (): void => {
    if (!existsSync(COVERAGE_JSON_PATH)) {
        console.error(
            `[branch-coverage-report] ${COVERAGE_JSON_PATH} が見つかりません。` +
                'まず `bun run test:branch-coverage` でカバレッジを取得してください。',
        );
        return;
    }

    const raw = JSON.parse(readFileSync(COVERAGE_JSON_PATH, 'utf8'));
    const coverageMap = createCoverageMap(raw);

    const context = createContext({
        dir: REPORT_DIR,
        coverageMap,
    });
    createReporter('lcov').execute(context);
    createReporter('html').execute(context);

    console.log('\n📊 分岐カバレッジ（C1、core、実験的）\n');
    for (const file of coverageMap.files()) {
        const summary = coverageMap.fileCoverageFor(file).toSummary();
        const { branches } = summary;
        console.log(
            `  ${branches.pct}% (${branches.covered}/${branches.total})  ${file}`,
        );
    }
    console.log(`\n詳細レポート: ${REPORT_DIR}/index.html\n`);
};

main();
