/**
 * joinRequestsPage.test.ts - renderJoinRequestsPage ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | isProduction | 期待値                                                  |
 * |---|--------------|----------------------------------------------------------|
 * | 1 | false        | testのfavicon・「テスト環境」バッジ                       |
 * | 2 | true         | productionのfavicon・「本番環境」バッジ                   |
 * | 3 | いずれも     | 一覧テーブルの列見出し・承認/却下ボタン・エラー領域のrole="alert"が含まれる |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import {
    PRODUCTION_FAVICON_DATA_URI,
    TEST_FAVICON_DATA_URI,
} from '../../../src/controller/faviconAssets';
import { renderJoinRequestsPage } from '../../../src/controller/joinRequestsPage';

describe('admin/controller/renderJoinRequestsPage', () => {
    it('1: isProduction=falseの場合はtest向けfavicon・バッジを返すこと', () => {
        const html = renderJoinRequestsPage(false);

        expect(html).toContain(
            `<link rel="icon" href="${TEST_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge test">テスト環境');
        expect(html).not.toContain(PRODUCTION_FAVICON_DATA_URI);
    });

    it('2: isProduction=trueの場合はproduction向けfavicon・バッジを返すこと', () => {
        const html = renderJoinRequestsPage(true);

        expect(html).toContain(
            `<link rel="icon" href="${PRODUCTION_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge production">本番環境');
        expect(html).not.toContain(TEST_FAVICON_DATA_URI);
    });

    it('3: 一覧テーブルの列見出し・承認/却下ボタン・エラー領域のrole="alert"が含まれること', () => {
        const html = renderJoinRequestsPage(false);

        expect(html).toContain('<th>ニックネーム</th>');
        expect(html).toContain('<th>操作</th>');
        expect(html).toContain("approveButton.textContent = '承認';");
        expect(html).toContain("rejectButton.textContent = '却下';");
        expect(html).toContain(
            '<p id="error" class="error" role="alert" tabindex="-1" hidden></p>',
        );
        expect(html).toContain('errorEl.focus();');
        expect(html).toContain("fetch('/join-requests/api')");
    });
});
