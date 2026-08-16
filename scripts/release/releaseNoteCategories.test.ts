/**
 * releaseNoteCategories.ts の自己テスト
 *
 * ## デシジョンテーブル
 *
 * ### headingForCategory
 * | # | key | 期待 |
 * |---|-----|------|
 * | T-01 | backend | '## 🔧 バックエンドのみ' |
 * | T-02 | frontend | '## 📱 フロントの変更' |
 * | T-03 | unknown-key | other の見出しにフォールバック |
 */
import { describe, expect, it } from 'bun:test';

import { headingForCategory } from './releaseNoteCategories';

describe('headingForCategory', () => {
    it('T-01_backendの場合_バックエンド見出しを返す', () => {
        const result = headingForCategory('backend');

        expect(result).toBe('## 🔧 バックエンドのみ');
    });

    it('T-02_frontendの場合_フロント見出しを返す', () => {
        const result = headingForCategory('frontend');

        expect(result).toBe('## 📱 フロントの変更');
    });

    it('T-03_未知のキーの場合_その他見出しにフォールバックする', () => {
        const result = headingForCategory('unknown-key');

        expect(result).toBe('## 📝 その他');
    });
});
