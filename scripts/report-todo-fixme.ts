#!/usr/bin/env bun
/**
 * report-todo-fixme.ts
 *
 * AIEFF-066対応: リポジトリ内に散在する TODO/FIXME コメントが棚卸しされていない問題への
 * 対応として、`packages/*` と `scripts/` 配下の TypeScript/Dart ファイルを走査し、
 * TODO/FIXME コメント一覧をファイル別にまとめた markdown レポートを生成する
 * （BACKLOG候補の一次スクリーニング用途）。
 *
 * 使い方:
 *   bun scripts/report-todo-fixme.ts
 *   → docs/generated/todo-fixme-report.md を生成
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface TodoEntry {
    file: string;
    line: number;
    marker: 'TODO' | 'FIXME';
    text: string;
}

const RE_MARKER = /\b(TODO|FIXME)\b:?\s*(.*)$/;

/**
 * ファイル内容から TODO/FIXME コメントを行単位で抽出する
 * @param fileContent - ファイルの内容
 * @param filePath - レポートに表示するファイルパス（リポジトリルートからの相対パス）
 * @returns 検出したエントリの配列（出現順）
 */
export function extractTodoFixme(
    fileContent: string,
    filePath: string,
): TodoEntry[] {
    const entries: TodoEntry[] = [];
    const lines = fileContent.split('\n');
    for (const [index, line] of lines.entries()) {
        const match = RE_MARKER.exec(line);
        if (!match) {
            continue;
        }
        entries.push({
            file: filePath,
            line: index + 1,
            marker: match[1] as 'TODO' | 'FIXME',
            text: match[2].trim(),
        });
    }
    return entries;
}

/**
 * TODO/FIXME エントリ一覧を markdown レポートに整形する
 * @param entries - `extractTodoFixme` を全ファイル分集約したもの
 * @returns markdown 文字列
 */
export function formatMarkdownReport(entries: TodoEntry[]): string {
    const header = [
        '# TODO/FIXME 棚卸しレポート（自動生成）',
        '',
        '`bun scripts/report-todo-fixme.ts` で生成。BACKLOG化の要否は人手で判断すること。',
        '',
    ];
    if (entries.length === 0) {
        return [...header, '検出件数: 0件'].join('\n');
    }

    const rows = entries.map(
        (e) => `| \`${e.file}:${e.line}\` | ${e.marker} | ${e.text} |`,
    );
    return [
        ...header,
        `検出件数: ${entries.length}件`,
        '',
        '| 位置 | 種別 | 内容 |',
        '| --- | --- | --- |',
        ...rows,
        '',
    ].join('\n');
}

if (import.meta.main) {
    const repoRoot = join(import.meta.dir, '..');
    const glob = new Bun.Glob('{packages,scripts}/**/*.{ts,tsx,dart}');
    const entries: TodoEntry[] = [];
    for await (const relPath of glob.scan({ cwd: repoRoot, dot: false })) {
        const content = readFileSync(join(repoRoot, relPath), 'utf8');
        entries.push(...extractTodoFixme(content, relPath));
    }

    const outDir = join(repoRoot, 'docs', 'generated');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'todo-fixme-report.md');
    writeFileSync(outPath, formatMarkdownReport(entries));

    // eslint-disable-next-line no-console
    console.log(`✅ ${entries.length} 件の TODO/FIXME を検出（${outPath}）`);
}
