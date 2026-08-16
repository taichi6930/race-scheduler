/**
 * check-doc-duplication.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * TOK-016の検出ロジックの要となる部分のためUTを用意する。実ファイル
 * （.claude/docs/・.claude/skills/）には触れず、インメモリのfixtureのみで
 * 検証する（hermetic）。
 *
 * ## デシジョンテーブル
 *
 * ### isSignificantWindow
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | S1 | 意味のある文章3行 | true |
 * | S2 | 空行のみ3行 | false |
 * | S3 | テーブル区切り行のみ（`| --- | --- |`） | false |
 * | S4 | 短すぎる内容（合計20文字未満） | false |
 *
 * ### buildWindowIndex / extractPairMatches
 * | # | 状況 | 期待 |
 * |---|------|------|
 * | P1 | 2ファイルに同一の3行ブロックが存在 | ペアとして抽出される |
 * | P2 | 同一ファイル内にのみ同一ブロックが存在（重複なし） | ペアとして抽出されない |
 * | P3 | 一致するブロックが存在しない | ペアが空 |
 *
 * ### mergeContiguousBlocks
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | M1 | 開始行が両ファイルとも1ずつ連続してずれる3件のペア | 1つのブロック（lineCount=5）に統合される |
 * | M2 | 連続しない2件のペア | 2つの独立したブロックのまま |
 */

import { describe, expect, it } from 'bun:test';

import {
    buildWindowIndex,
    extractPairMatches,
    isSignificantWindow,
    mergeContiguousBlocks,
    type RawPairMatch,
    WINDOW_SIZE,
} from './check-doc-duplication';

describe('isSignificantWindow', () => {
    it('[S1] 意味のある文章3行はtrueになること', () => {
        expect(
            isSignificantWindow([
                'これはテスト用の規約文章の1行目です',
                'これはテスト用の規約文章の2行目です',
                'これはテスト用の規約文章の3行目です',
            ]),
        ).toBe(true);
    });

    it('[S2] 空行のみ3行はfalseになること', () => {
        expect(isSignificantWindow(['', '', ''])).toBe(false);
    });

    it('[S3] テーブル区切り行のみはfalseになること', () => {
        expect(isSignificantWindow(['| --- | --- |', '|---|---|', '==='])).toBe(
            false,
        );
    });

    it('[S4] 短すぎる内容（合計20文字未満）はfalseになること', () => {
        expect(isSignificantWindow(['a', 'b', 'c'])).toBe(false);
    });
});

describe('buildWindowIndex / extractPairMatches', () => {
    it('[P1] 2ファイルに同一の3行ブロックが存在する場合はペアとして抽出されること', () => {
        const shared = [
            'これは共有される規約文章の1行目です',
            'これは共有される規約文章の2行目です',
            'これは共有される規約文章の3行目です',
        ];
        const index = buildWindowIndex([
            { relPath: 'a.md', lines: shared },
            { relPath: 'b.md', lines: shared },
        ]);
        const pairs = extractPairMatches(index);

        expect(pairs).toEqual([
            { fileA: 'a.md', startA: 1, fileB: 'b.md', startB: 1 },
        ]);
    });

    it('[P2] 同一ファイル内にのみ同一ブロックが存在する場合はペアとして抽出されないこと', () => {
        const line = 'これは十分に長い規約文章の1行分です';
        const index = buildWindowIndex([
            {
                relPath: 'a.md',
                lines: [line, line, line, 'dummy', line, line, line],
            },
        ]);
        const pairs = extractPairMatches(index);

        expect(pairs).toEqual([]);
    });

    it('[P3] 一致するブロックが存在しない場合はペアが空になること', () => {
        const index = buildWindowIndex([
            {
                relPath: 'a.md',
                lines: ['これはaファイル固有の規約文章の内容です'],
            },
            {
                relPath: 'b.md',
                lines: ['これはbファイル固有の規約文章の内容です'],
            },
        ]);
        const pairs = extractPairMatches(index);

        expect(pairs).toEqual([]);
    });
});

describe('mergeContiguousBlocks', () => {
    it('[M1] 開始行が両ファイルとも1ずつ連続してずれる3件のペアは1つのブロックに統合されること', () => {
        const pairs: RawPairMatch[] = [
            { fileA: 'a.md', startA: 1, fileB: 'b.md', startB: 10 },
            { fileA: 'a.md', startA: 2, fileB: 'b.md', startB: 11 },
            { fileA: 'a.md', startA: 3, fileB: 'b.md', startB: 12 },
        ];

        const blocks = mergeContiguousBlocks(pairs);

        expect(blocks).toEqual([
            {
                fileA: 'a.md',
                startA: 1,
                fileB: 'b.md',
                startB: 10,
                lineCount: WINDOW_SIZE + 2,
                preview: '',
            },
        ]);
    });

    it('[M2] 連続しないペアは2つの独立したブロックのままであること', () => {
        const pairs: RawPairMatch[] = [
            { fileA: 'a.md', startA: 1, fileB: 'b.md', startB: 10 },
            { fileA: 'a.md', startA: 50, fileB: 'b.md', startB: 60 },
        ];

        const blocks = mergeContiguousBlocks(pairs);

        expect(blocks).toHaveLength(2);
        expect(blocks[0]?.lineCount).toBe(WINDOW_SIZE);
        expect(blocks[1]?.lineCount).toBe(WINDOW_SIZE);
    });
});
