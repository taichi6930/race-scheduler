/**
 * generate-claude-md-toc.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * 見出し抽出・スラグ化・目次組み立てを誤るとリンク切れの目次を生成してしまうため、
 * 純粋関数（fs 非依存）のUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### extractHeadings
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | `# タイトル` のみ | 空配列（h1は対象外） |
 * | T-02 | `## A` + `### B` | level 2/3 が出現順に抽出される |
 * | T-03 | コードフェンス内の `## comment` | 抽出されない |
 * | T-04 | 既存の toc:start/end マーカー間の見出し風テキスト | 抽出されない |
 *
 * ### slugify
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-05 | `` `code` を含む見出し `` | バッククォート除去後にスラグ化 |
 * | T-06 | 半角スペースを含む見出し | ハイフン区切りになる |
 *
 * ### buildToc / replaceTocSection
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-07 | 見出し1件（level2） | マーカー付きのリンク行を含む |
 * | T-08 | level3見出し | インデント付きリンク行になる |
 * | T-09 | マーカー有りの本文 | マーカー間だけが新しい目次に置換される |
 * | T-10 | マーカー無しの本文 | 元の内容がそのまま返る |
 */
import { describe, expect, it } from 'bun:test';

import {
    buildToc,
    extractHeadings,
    replaceTocSection,
    slugify,
} from './generate-claude-md-toc';

describe('extractHeadings', () => {
    it('[T-01] h1のみの場合は空配列を返すこと', () => {
        expect(extractHeadings('# タイトル\n本文')).toEqual([]);
    });

    it('[T-02] h2/h3を出現順に抽出すること', () => {
        expect(extractHeadings('## A\n本文\n### B')).toEqual([
            { level: 2, text: 'A' },
            { level: 3, text: 'B' },
        ]);
    });

    it('[T-03] コードフェンス内の見出し風テキストは抽出しないこと', () => {
        const content = '```\n## not a heading\n```\n## real';
        expect(extractHeadings(content)).toEqual([{ level: 2, text: 'real' }]);
    });

    it('[T-04] toc:start/endマーカー間は抽出しないこと', () => {
        const content =
            '<!-- toc:start -->\n## old entry\n<!-- toc:end -->\n## real';
        expect(extractHeadings(content)).toEqual([{ level: 2, text: 'real' }]);
    });
});

describe('slugify', () => {
    it('[T-05] バッククォートを除去してスラグ化すること', () => {
        expect(slugify('`code` を含む見出し')).toBe('code-を含む見出し');
    });

    it('[T-06] 半角スペースをハイフンに変換すること', () => {
        expect(slugify('hello world')).toBe('hello-world');
    });
});

describe('buildToc / replaceTocSection', () => {
    it('[T-07] level2見出しはマーカー付きのリンク行になること', () => {
        const toc = buildToc([{ level: 2, text: 'A' }]);
        expect(toc).toBe('<!-- toc:start -->\n- [A](#a)\n<!-- toc:end -->');
    });

    it('[T-08] level3見出しはインデント付きになること', () => {
        const toc = buildToc([{ level: 3, text: 'B' }]);
        expect(toc).toContain('    - [B](#b)');
    });

    it('[T-09] マーカーがある本文はマーカー間だけ置換されること', () => {
        const content =
            '前文\n<!-- toc:start -->\n古い内容\n<!-- toc:end -->\n後文';
        const toc = '<!-- toc:start -->\n- [新](#新)\n<!-- toc:end -->';
        expect(replaceTocSection(content, toc)).toBe(
            '前文\n<!-- toc:start -->\n- [新](#新)\n<!-- toc:end -->\n後文',
        );
    });

    it('[T-10] マーカーが無い本文はそのまま返ること', () => {
        const content = '前文\n本文\n後文';
        expect(
            replaceTocSection(content, '<!-- toc:start -->\n<!-- toc:end -->'),
        ).toBe(content);
    });
});
