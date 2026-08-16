/**
 * errorPages.test.ts - renderNotFoundPage / renderServerErrorPage ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | 関数                    | isProduction | 期待値                                        |
 * |---|--------------------------|--------------|------------------------------------------------|
 * | 1 | renderNotFoundPage       | false        | 404タイトル・共通ナビゲーション・doctypeを含む |
 * | 2 | renderServerErrorPage    | true         | 500タイトル・共通ナビゲーション・doctypeを含む |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';

import {
    renderNotFoundPage,
    renderServerErrorPage,
} from '../../../src/controller/errorPages';

describe('admin/controller/errorPages', () => {
    it('1: renderNotFoundPageは404タイトル・共通ナビゲーション・doctypeを含むこと', () => {
        const html = renderNotFoundPage(false);

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('404 Not Found');
        expect(html).toContain('class="admin-nav"');
        expect(html).toContain(
            '<a class="nav-item" href="/flags">機能フラグ管理</a>',
        );
    });

    it('2: renderServerErrorPageは500タイトル・共通ナビゲーション・doctypeを含むこと', () => {
        const html = renderServerErrorPage(true);

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('500 Internal Server Error');
        expect(html).toContain('class="admin-nav"');
        expect(html).toContain('env-badge production">本番環境');
    });
});
