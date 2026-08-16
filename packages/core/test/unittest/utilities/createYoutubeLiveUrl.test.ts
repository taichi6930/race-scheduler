import { describe, expect, it } from 'bun:test';

import { createYoutubeLiveUrl } from '../../../src/utilities/createYoutubeLiveUrl';

/**
 * createYoutubeLiveUrl のデシジョンテーブル
 *
 * | ケース | 入力（userId） | 期待される出力 | 説明 |
 * |--------|---------------|----------------|------|
 * | 1 | 'testuser123' | 'https://www.youtube.com/@testuser123/stream' | 通常のユーザーID |
 * | 2 | 'channel_name-123' | 'https://www.youtube.com/@channel_name-123/stream' | アンダースコアとハイフンを含むチャンネル名 |
 * | 3 | '' | 'https://www.youtube.com/@/stream' | 空文字列 |
 */
describe('createYoutubeLiveUrl', () => {
    it('ケース1: 通常のユーザーID', () => {
        const userId = 'testuser123';
        const result = createYoutubeLiveUrl(userId);
        expect(result).toBe('https://www.youtube.com/@testuser123/stream');
    });

    it('ケース2: アンダースコアとハイフンを含むチャンネル名', () => {
        const userId = 'channel_name-123';
        const result = createYoutubeLiveUrl(userId);
        expect(result).toBe('https://www.youtube.com/@channel_name-123/stream');
    });

    it('ケース3: 空文字列', () => {
        const userId = '';
        const result = createYoutubeLiveUrl(userId);
        expect(result).toBe('https://www.youtube.com/@/stream');
    });
});
