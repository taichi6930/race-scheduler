/**
 * featureFlagsPage.test.ts - renderFeatureFlagsPage ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | isProduction | 期待値                                                  |
 * |---|--------------|----------------------------------------------------------|
 * | 1 | false        | testのfavicon・「テスト環境」バッジ・READ_ONLY=false      |
 * | 2 | true         | productionのfavicon・「本番環境」バッジ・READ_ONLY=true   |
 * | 3 | いずれも     | 読み込み中表示（QADM-12）・エラー領域のrole="alert"（QADM-08）が含まれる |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import {
    PRODUCTION_FAVICON_DATA_URI,
    TEST_FAVICON_DATA_URI,
} from '../../../src/controller/faviconAssets';
import { renderFeatureFlagsPage } from '../../../src/controller/featureFlagsPage';

describe('admin/controller/renderFeatureFlagsPage', () => {
    it('1: isProduction=falseの場合はtest向けfavicon・バッジ・操作可能なスイッチを返すこと', () => {
        const html = renderFeatureFlagsPage(false);

        expect(html).toContain(
            `<link rel="icon" href="${TEST_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge test">テスト環境');
        expect(html).toContain('var READ_ONLY = false;');
        expect(html).not.toContain(PRODUCTION_FAVICON_DATA_URI);
    });

    it('2: isProduction=trueの場合はproduction向けfavicon・バッジ・読み取り専用のスイッチを返すこと', () => {
        const html = renderFeatureFlagsPage(true);

        expect(html).toContain(
            `<link rel="icon" href="${PRODUCTION_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge production">本番環境');
        expect(html).toContain('var READ_ONLY = true;');
        expect(html).toContain('本番環境ではフラグの切り替えはできません');
        expect(html).not.toContain(TEST_FAVICON_DATA_URI);
    });

    it('3: 読み込み中表示・エラー領域のrole="alert"が含まれること', () => {
        const html = renderFeatureFlagsPage(false);

        expect(html).toContain(
            '<p id="loading" class="hint" role="status">読み込み中…</p>',
        );
        expect(html).toContain(
            '<p id="error" class="error" role="alert" tabindex="-1" hidden></p>',
        );
        expect(html).toContain('errorEl.focus();');
        expect(html).toContain('loadingEl.hidden = true;');
    });
});
