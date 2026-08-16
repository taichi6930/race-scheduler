#!/usr/bin/env bun
/**
 * report-slow-tests.ts
 *
 * `bun test` を JUnit レポーター付きで実行し、ファイル別合計実行時間の上位N件を
 * Markdownで報告する（CICD-45）。CICD-41（`singleThreaded` 解除の判断）や
 * CICD-46（scrapingフィクスチャ共有の要否判断）の前提データを作るための計測手段。
 *
 * 使い方:
 *   bun scripts/report-slow-tests.ts [--top=20]
 */

/* eslint-disable no-console */
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface TestCaseTiming {
    file: string;
    seconds: number;
}

const parseTopArg = (argv: string[]): number => {
    const arg = argv.find((a) => a.startsWith('--top='));
    return arg ? Number(arg.split('=')[1]) : 20;
};

/** JUnit XMLの各`<testcase .../>`から file/time 属性を抽出する（属性の順序に依存しない） */
const parseTestCases = (xml: string): TestCaseTiming[] => {
    const cases: TestCaseTiming[] = [];
    const testcaseTagPattern = /<testcase\b[^>]*\/>/g;
    for (const tag of xml.match(testcaseTagPattern) ?? []) {
        const fileMatch = /\sfile="([^"]*)"/.exec(tag);
        const timeMatch = /\stime="([^"]*)"/.exec(tag);
        if (fileMatch && timeMatch) {
            cases.push({ file: fileMatch[1], seconds: Number(timeMatch[1]) });
        }
    }
    return cases;
};

/** ファイルごとに合計実行時間を集計し、降順ソートする */
const aggregateByFile = (
    cases: TestCaseTiming[],
): { file: string; totalSeconds: number }[] => {
    const totals = new Map<string, number>();
    for (const { file, seconds } of cases) {
        totals.set(file, (totals.get(file) ?? 0) + seconds);
    }
    return [...totals.entries()]
        .map(([file, totalSeconds]) => ({ file, totalSeconds }))
        .sort((a, b) => b.totalSeconds - a.totalSeconds);
};

const runTestsWithJunitReport = (outfile: string): void => {
    // packages/*/test はシェルのglob展開に依存するため、execFileSyncではなく
    // bashのシェル経由で実行する（package.jsonの各testスクリプトと同じ方式）。
    // sIT（実D1/R2が必要）は `bun run test` と同様に除外し、計測目的の対象を
    // UT/Componentに揃える。テストの成否はこのスクリプトの関心事ではない（時間計測のみ）
    // ため、失敗があってもexit codeでは落とさずJUnit出力の読み取りへ進む。
    try {
        execFileSync(
            'bash',
            [
                '-c',
                `bun test packages/*/test --reporter=junit --reporter-outfile="${outfile}" --path-ignore-patterns '**/test/integration/system/**'`,
            ],
            {
                env: {
                    ...process.env,
                    NODE_ENV: 'ci_local',
                    TZ: 'jst',
                    HTML_FETCH_DELAY_MS: '0',
                    USE_IN_MEMORY_DB: 'true',
                },
                stdio: 'inherit',
            },
        );
    } catch {
        // テスト失敗時もJUnit出力自体は書き出されるため、計測目的では無視して続行する
    }
};

const buildReport = (
    rows: { file: string; totalSeconds: number }[],
    top: number,
): string =>
    [
        `## テストファイル別 実行時間 上位${top}件（CICD-45）`,
        '',
        '| ファイル | 合計秒数 |',
        '| --- | --- |',
        ...rows
            .slice(0, top)
            .map((r) => `| ${r.file} | ${r.totalSeconds.toFixed(3)} |`),
    ].join('\n');

const main = (): void => {
    const top = parseTopArg(process.argv.slice(2));
    const outfile = join(tmpdir(), `bun-junit-${process.pid}.xml`);
    try {
        runTestsWithJunitReport(outfile);
        const xml = readFileSync(outfile, 'utf-8');
        const rows = aggregateByFile(parseTestCases(xml));
        console.log(buildReport(rows, top));
    } finally {
        try {
            unlinkSync(outfile);
        } catch {
            // 一時ファイルが無ければ何もしない
        }
    }
};

main();
