/**
 * strip-html-comments.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * production配信物からコメントを取り除く中核ロジックのためUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### stripHtmlComments
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-01 | 単一行コメントを含むHTML | コメントが除去される |
 * | T-02 | 複数行コメントを含むHTML | コメント全体が除去される |
 * | T-03 | 複数のコメントを含むHTML | 全てのコメントが除去される |
 * | T-04 | `<!DOCTYPE html>` を含むHTML | DOCTYPE宣言は除去されない |
 * | T-05 | コメントを含まないHTML | 変化しない |
 * | T-06 | 入れ子状で除去後に新たなコメントが再構成されるHTML | 再構成された分も除去される |
 */

import { describe, expect, it } from 'bun:test';

import { stripHtmlComments } from './strip-html-comments';

describe('stripHtmlComments', () => {
    it('[T-01] 単一行コメントを含むHTMLはコメントが除去されること', () => {
        const html = '<div><!-- note --><p>hello</p></div>';

        expect(stripHtmlComments(html)).toBe('<div><p>hello</p></div>');
    });

    it('[T-02] 複数行コメントを含むHTMLはコメント全体が除去されること', () => {
        const html = '<div><!--\n  line1\n  line2\n--><p>hello</p></div>';

        expect(stripHtmlComments(html)).toBe('<div><p>hello</p></div>');
    });

    it('[T-03] 複数のコメントを含むHTMLは全てのコメントが除去されること', () => {
        const html = '<!-- a --><div>x</div><!-- b -->';

        expect(stripHtmlComments(html)).toBe('<div>x</div>');
    });

    it('[T-04] DOCTYPE宣言は除去されないこと', () => {
        const html = '<!DOCTYPE html>\n<html></html>';

        expect(stripHtmlComments(html)).toBe(html);
    });

    it('[T-05] コメントを含まないHTMLは変化しないこと', () => {
        const html = '<div><p>hello</p></div>';

        expect(stripHtmlComments(html)).toBe(html);
    });

    it('[T-06] 除去後に前後が結合して新たなコメントが再構成される場合、再構成された分も除去されること', () => {
        // "x<!-" と "-y-->z" の間の "<!--REMOVED-->" だけを1回で除去すると、
        // 残った "x<!-" + "-y-->z" が結合して新たな "<!--y-->" が再構成されてしまう
        // （CodeQL js/incomplete-multi-character-sanitization）。固定点まで
        // 繰り返すことでこの再構成分も除去されることを検証する。
        const html = 'x<!-<!--REMOVED-->-y-->z';

        expect(stripHtmlComments(html)).toBe('xz');
    });
});
