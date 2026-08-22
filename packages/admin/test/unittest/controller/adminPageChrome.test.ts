/**
 * adminPageChrome.test.ts - faviconFor / renderAdminHeader ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### faviconFor
 * | # | isProduction | 期待値                    |
 * |---|--------------|----------------------------|
 * | 1 | false        | TEST_FAVICON_DATA_URI      |
 * | 2 | true         | PRODUCTION_FAVICON_DATA_URI |
 *
 * ### renderAdminHeader
 * | # | currentPath  | 期待値                                              |
 * |---|--------------|--------------------------------------------------------|
 * | 3 | '/flags'     | '/flags'は現在地表示、'/backfill'はリンクとして出る    |
 * | 4 | '/backfill'  | '/backfill'は現在地表示、'/flags'はリンクとして出る、Widgetbookへの外部リンクが出る |
 *
 * ### CHROME_STYLE（QADM-09: ダークモード対応）
 * | # | 期待値 |
 * |---|--------|
 * | 5 | `:root` にライトテーマのCSSカスタムプロパティを宣言している |
 * | 6 | `@media (prefers-color-scheme: dark)` でダークテーマの値に上書きしている |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';

import {
    CHROME_STYLE,
    FRONT_COLORS,
    FRONT_COLORS_DARK,
    faviconFor,
    renderAdminHeader,
} from '../../../src/controller/adminPageChrome';
import {
    PRODUCTION_FAVICON_DATA_URI,
    TEST_FAVICON_DATA_URI,
} from '../../../src/controller/faviconAssets';

describe('admin/controller/faviconFor', () => {
    it('1: isProduction=falseの場合はTEST_FAVICON_DATA_URIを返すこと', () => {
        expect(faviconFor(false)).toBe(TEST_FAVICON_DATA_URI);
    });

    it('2: isProduction=trueの場合はPRODUCTION_FAVICON_DATA_URIを返すこと', () => {
        expect(faviconFor(true)).toBe(PRODUCTION_FAVICON_DATA_URI);
    });
});

describe('admin/controller/renderAdminHeader', () => {
    it("3: currentPath='/flags'の場合、/flagsが現在地表示・/backfillがリンクになること", () => {
        const html = renderAdminHeader('機能フラグ管理', false, '/flags');

        expect(html).toContain(
            '<span class="nav-item nav-current">機能フラグ管理</span>',
        );
        expect(html).toContain(
            '<a class="nav-item" href="/backfill">バックフィル実行</a>',
        );
    });

    it("4: currentPath='/backfill'の場合、/backfillが現在地表示・/flagsがリンクになること", () => {
        const html = renderAdminHeader('バックフィル実行', true, '/backfill');

        expect(html).toContain(
            '<span class="nav-item nav-current">バックフィル実行</span>',
        );
        expect(html).toContain(
            '<a class="nav-item" href="/flags">機能フラグ管理</a>',
        );
        expect(html).toContain('env-badge production">本番環境');
        expect(html).toContain(
            '<a class="nav-item nav-external" href="https://race-scheduler-widgetbook.pages.dev" target="_blank" rel="noopener noreferrer">Widgetbook（デザインカタログ） ↗</a>',
        );
    });
});

describe('admin/controller/CHROME_STYLE', () => {
    it('5: :rootにライトテーマ（FRONT_COLORS）のCSSカスタムプロパティを宣言していること', () => {
        expect(CHROME_STYLE).toContain(`--bg: ${FRONT_COLORS.bg};`);
        expect(CHROME_STYLE).toContain(`--brand: ${FRONT_COLORS.brand};`);
    });

    it('6: prefers-color-scheme: darkでダークテーマ（FRONT_COLORS_DARK）の値に上書きしていること', () => {
        const darkBlockMatch = CHROME_STYLE.match(
            /@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\}\n\}/,
        );
        expect(darkBlockMatch).not.toBeNull();
        expect(darkBlockMatch?.[1]).toContain(`--bg: ${FRONT_COLORS_DARK.bg};`);
        expect(darkBlockMatch?.[1]).toContain(
            `--brand: ${FRONT_COLORS_DARK.brand};`,
        );
    });
});
