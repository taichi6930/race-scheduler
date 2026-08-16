#!/usr/bin/env bun
/**
 * check-large-markdown.ts
 *
 * PRで変更（追加/更新）された `.md` ファイルのうち、20KBを超えるものを警告する
 * （TOK-041）。大型ドキュメントはAIエージェントが探索・Readするたびのトークンを
 * 押し上げるため、肥大化を早期に可視化する。
 *
 * ブロッキングにはしない（20KB超自体は誤りではなく、分割の要否は内容次第の
 * ため）。CIでは常に exit 0 とし、$GITHUB_STEP_SUMMARY への警告表示のみ行う。
 *
 * 使い方:
 *   git diff --name-only <base> <head> > changed-files.txt
 *   bun scripts/check-large-markdown.ts changed-files.txt
 *   bun scripts/check-large-markdown.ts changed-files.txt --json
 */

/* eslint-disable no-console */
import { existsSync, readFileSync, statSync } from 'node:fs';

const THRESHOLD_BYTES = 20 * 1024;

interface LargeMarkdownFile {
    file: string;
    sizeBytes: number;
}

/**
 * 変更ファイル一覧（1行1パス）から、実在する `.md` ファイルの一覧を抽出する。
 * 削除されたファイル（一覧には残るがディスク上に存在しない）は対象外。
 * @param changedFilesContent changed-files.txt相当の内容（改行区切り）
 */
function extractExistingMarkdownFiles(changedFilesContent: string): string[] {
    return changedFilesContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.endsWith('.md'))
        .filter((file) => existsSync(file));
}

/**
 * 対象ファイルのうち、閾値（[THRESHOLD_BYTES]）を超えるものを抽出する。
 * @param files 対象ファイルパス一覧
 */
function findLargeMarkdownFiles(files: string[]): LargeMarkdownFile[] {
    return files
        .map((file) => ({ file, sizeBytes: statSync(file).size }))
        .filter((entry) => entry.sizeBytes > THRESHOLD_BYTES);
}

function main(): void {
    const args = process.argv.slice(2);
    const changedFilesPath = args.find((arg) => !arg.startsWith('--'));
    const isJson = args.includes('--json');

    if (!changedFilesPath) {
        console.error(
            '使い方: bun scripts/check-large-markdown.ts <changed-files.txt> [--json]',
        );
        process.exit(1);
    }

    const changedFilesContent = readFileSync(changedFilesPath, 'utf8');
    const markdownFiles = extractExistingMarkdownFiles(changedFilesContent);
    const largeFiles = findLargeMarkdownFiles(markdownFiles);

    if (isJson) {
        process.stdout.write(`${JSON.stringify({ largeFiles }, null, 2)}\n`);
        return;
    }

    if (largeFiles.length === 0) {
        console.log('✅ 20KB超の変更されたMarkdownファイルはありません');
        return;
    }

    console.log(
        `⚠️  20KB超のMarkdownファイルが${largeFiles.length}件変更されています（分割を検討してください）:`,
    );
    for (const entry of largeFiles) {
        const sizeKb = (entry.sizeBytes / 1024).toFixed(1);
        console.log(`   - ${entry.file}（${sizeKb} KB）`);
    }
}

if (import.meta.main) {
    main();
}

export type { LargeMarkdownFile };
export {
    extractExistingMarkdownFiles,
    findLargeMarkdownFiles,
    THRESHOLD_BYTES,
};
