/**
 * check-large-markdown.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * TOK-041のブロッキングにはしない警告チェックの中核ロジックのためUTを用意する。
 * 実ファイルには触れず、一時ディレクトリのfixtureのみで検証する（hermetic）。
 *
 * ## デシジョンテーブル
 *
 * ### extractExistingMarkdownFiles
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | E1 | .mdファイルと.tsファイルが混在 | .mdファイルのみ抽出される |
 * | E2 | 一覧にあるが実在しないファイル（削除済み） | 対象外（存在確認で除外） |
 * | E3 | 空行を含む一覧 | 空行は無視される |
 *
 * ### findLargeMarkdownFiles
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | F1 | 20KBちょうどのファイル | 対象外（超過のみ検出） |
 * | F2 | 20KBを超えるファイル | 対象として検出される |
 * | F3 | 20KB未満のファイル | 対象外 |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    extractExistingMarkdownFiles,
    findLargeMarkdownFiles,
    THRESHOLD_BYTES,
} from './check-large-markdown';

describe('extractExistingMarkdownFiles', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'large-markdown-test-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('[E1] .mdファイルと.tsファイルが混在する場合は.mdファイルのみ抽出されること', () => {
        const mdFile = join(dir, 'doc.md');
        const tsFile = join(dir, 'index.ts');
        writeFileSync(mdFile, 'hello');
        writeFileSync(tsFile, 'export {};');

        const result = extractExistingMarkdownFiles(`${mdFile}\n${tsFile}`);

        expect(result).toEqual([mdFile]);
    });

    it('[E2] 一覧にあるが実在しないファイル（削除済み）は対象外になること', () => {
        const missing = join(dir, 'deleted.md');

        const result = extractExistingMarkdownFiles(missing);

        expect(result).toEqual([]);
    });

    it('[E3] 空行を含む一覧では空行が無視されること', () => {
        const mdFile = join(dir, 'doc.md');
        writeFileSync(mdFile, 'hello');

        const result = extractExistingMarkdownFiles(`\n${mdFile}\n\n`);

        expect(result).toEqual([mdFile]);
    });
});

describe('findLargeMarkdownFiles', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'large-markdown-test-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('[F1] 20KBちょうどのファイルは対象外になること', () => {
        const file = join(dir, 'exact.md');
        writeFileSync(file, 'a'.repeat(THRESHOLD_BYTES));

        expect(findLargeMarkdownFiles([file])).toEqual([]);
    });

    it('[F2] 20KBを超えるファイルは対象として検出されること', () => {
        const file = join(dir, 'large.md');
        const size = THRESHOLD_BYTES + 1;
        writeFileSync(file, 'a'.repeat(size));

        expect(findLargeMarkdownFiles([file])).toEqual([
            { file, sizeBytes: size },
        ]);
    });

    it('[F3] 20KB未満のファイルは対象外になること', () => {
        const file = join(dir, 'small.md');
        writeFileSync(file, 'a'.repeat(100));

        expect(findLargeMarkdownFiles([file])).toEqual([]);
    });
});
