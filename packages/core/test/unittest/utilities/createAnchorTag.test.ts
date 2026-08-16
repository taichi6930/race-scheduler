import { describe, expect, it } from 'bun:test';

import { createAnchorTag } from '../../../src/utilities/createAnchorTag';

/**
 * createAnchorTag のデシジョンテーブル
 *
 * | ケース | 入力（text） | 入力（url） | 期待される出力 | 説明 |
 * |--------|-------------|-----------|----------------|------|
 * | 1 | 'Google' | 'https://www.google.com' | '<a href="https://www.google.com">Google</a>' | 通常のテキストとURL |
 * | 2 | 'リンク' | 'https://example.com/path?query=value' | '<a href="https://example.com/path?query=value">リンク</a>' | 日本語テキストとクエリパラメータ付きURL |
 * | 3 | '' | 'https://example.com' | '<a href="https://example.com"></a>' | 空文字列テキスト |
 * | 4 | 'リンク' | '' | '<a href="">リンク</a>' | 空文字列URL |
 * | 5 | '<script>alert("XSS")</script>' | 'javascript:alert("XSS")' | '<a href="javascript:alert("XSS")"><script>alert("XSS")</script></a>' | XSSベクトル（エスケープなし） |
 */
describe('createAnchorTag', () => {
    it('ケース1: 通常のテキストとURL', () => {
        const text = 'Google';
        const url = 'https://www.google.com';
        const result = createAnchorTag(text, url);
        expect(result).toBe('<a href="https://www.google.com">Google</a>');
    });

    it('ケース2: 日本語テキストとクエリパラメータ付きURL', () => {
        const text = 'リンク';
        const url = 'https://example.com/path?query=value';
        const result = createAnchorTag(text, url);
        expect(result).toBe(
            '<a href="https://example.com/path?query=value">リンク</a>',
        );
    });

    it('ケース3: 空文字列テキスト', () => {
        const text = '';
        const url = 'https://example.com';
        const result = createAnchorTag(text, url);
        expect(result).toBe('<a href="https://example.com"></a>');
    });

    it('ケース4: 空文字列URL', () => {
        const text = 'リンク';
        const url = '';
        const result = createAnchorTag(text, url);
        expect(result).toBe('<a href="">リンク</a>');
    });

    it('ケース5: XSSベクトル（エスケープなし）', () => {
        const text = '<script>alert("XSS")</script>';
        const url = 'javascript:alert("XSS")';
        const result = createAnchorTag(text, url);
        expect(result).toBe(
            '<a href="javascript:alert("XSS")"><script>alert("XSS")</script></a>',
        );
    });
});
