#!/usr/bin/env bun
/**
 * report-test-summary.ts
 *
 * scripts/generate-test-report.ts build が生成した test-report/report.json を
 * Markdown表に変換して標準出力する。CI（test-report.yml）が $GITHUB_STEP_SUMMARY へ
 * リダイレクトして使う。
 *
 * 使い方: bun scripts/report-test-summary.ts >> "$GITHUB_STEP_SUMMARY"
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface SummaryCell {
    files: number;
    executedFiles: number;
    pass: number;
    fail: number;
    skip: number;
}

interface Report {
    generatedAt: string;
    summary: Record<string, Record<string, SummaryCell>>;
}

const loadReport = (): Report => {
    const path = join(process.cwd(), 'test-report', 'report.json');
    return JSON.parse(readFileSync(path, 'utf8'));
};

const buildMarkdown = (report: Report): string => {
    const lines = [
        '# テストレポート',
        '',
        `生成日時: ${report.generatedAt}`,
        '',
    ];
    lines.push(
        '| レイヤー | パッケージ | ファイル数 | 実行済み | pass | fail | skip |',
    );
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const [layer, byPkg] of Object.entries(report.summary)) {
        for (const [pkg, cell] of Object.entries(byPkg)) {
            lines.push(
                `| ${layer} | ${pkg} | ${cell.files} | ${cell.executedFiles} | ${cell.pass} | ${cell.fail} | ${cell.skip} |`,
            );
        }
    }
    lines.push(
        '',
        '詳細は GitHub Pages（このリポジトリの Pages URL、mainマージ後に自動更新）または',
        'Artifact「test-report」内の index.html を参照してください。',
    );
    return lines.join('\n');
};

if (import.meta.main) {
    process.stdout.write(`${buildMarkdown(loadReport())}\n`);
}

export { buildMarkdown };
