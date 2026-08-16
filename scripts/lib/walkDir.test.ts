/**
 * walkDir.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * 4スクリプト（check-doc-duplication/generate-test-report/spec-coverage/
 * test-gap-analysis）が共通で依存する再帰走査ロジックのためUTを用意する。
 * 実ファイルには触れず、一時ディレクトリのfixtureのみで検証する（hermetic）。
 *
 * ## デシジョンテーブル
 *
 * ### walkDir
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | T-01 | ネストしたディレクトリ配下に複数ファイル | 全ファイルを再帰的に収集する |
 * | T-02 | predicate指定あり（拡張子フィルタ） | 条件に合致するファイルのみ収集する |
 * | T-03 | 存在しないディレクトリ | 例外を投げず空配列を返す |
 * | T-04 | 空ディレクトリ | 空配列を返す |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { walkDir } from './walkDir';

describe('walkDir', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'walk-dir-test-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('[T-01] ネストしたディレクトリ配下の全ファイルを再帰的に収集すること', () => {
        const nested = join(dir, 'nested');
        mkdirSync(nested);
        const fileA = join(dir, 'a.txt');
        const fileB = join(nested, 'b.txt');
        writeFileSync(fileA, 'a');
        writeFileSync(fileB, 'b');

        const result = walkDir(dir);

        expect(result.sort()).toEqual([fileA, fileB].sort());
    });

    it('[T-02] predicate指定時は条件に合致するファイルのみ収集すること', () => {
        const mdFile = join(dir, 'doc.md');
        const tsFile = join(dir, 'index.ts');
        writeFileSync(mdFile, 'hello');
        writeFileSync(tsFile, 'export {};');

        const result = walkDir(dir, (full) => full.endsWith('.md'));

        expect(result).toEqual([mdFile]);
    });

    it('[T-03] 存在しないディレクトリを指定しても例外を投げず空配列を返すこと', () => {
        const missing = join(dir, 'does-not-exist');

        expect(walkDir(missing)).toEqual([]);
    });

    it('[T-04] 空ディレクトリの場合は空配列を返すこと', () => {
        expect(walkDir(dir)).toEqual([]);
    });
});
