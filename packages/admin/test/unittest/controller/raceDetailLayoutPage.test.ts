/**
 * raceDetailLayoutPage.test.ts - renderRaceDetailLayoutPage ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | isProduction | 期待値                                                  |
 * |---|--------------|----------------------------------------------------------|
 * | 1 | false        | testのfavicon・「テスト環境」バッジ                       |
 * | 2 | true         | productionのfavicon・「本番環境」バッジ                   |
 * | 3 | -            | フィールドカタログ（7キー）が埋め込まれていること         |
 * | 4 | -            | 使い方の説明・プレビュー用レース選択欄が含まれていること   |
 * | 5 | -            | 未保存離脱ガード（beforeunload・dirtyトラッキング）が含まれていること（QADM-05） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import {
    PRODUCTION_FAVICON_DATA_URI,
    TEST_FAVICON_DATA_URI,
} from '../../../src/controller/faviconAssets';
import { renderRaceDetailLayoutPage } from '../../../src/controller/raceDetailLayoutPage';

describe('admin/controller/renderRaceDetailLayoutPage', () => {
    it('1: isProduction=falseの場合はtest向けfavicon・バッジを返すこと', () => {
        const html = renderRaceDetailLayoutPage(false);

        expect(html).toContain(
            `<link rel="icon" href="${TEST_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge test">テスト環境');
        expect(html).not.toContain(PRODUCTION_FAVICON_DATA_URI);
    });

    it('2: isProduction=trueの場合はproduction向けfavicon・バッジを返すこと', () => {
        const html = renderRaceDetailLayoutPage(true);

        expect(html).toContain(
            `<link rel="icon" href="${PRODUCTION_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge production">本番環境');
        expect(html).not.toContain(TEST_FAVICON_DATA_URI);
    });

    it('3: フィールドカタログ（7キー）が埋め込まれていること', () => {
        const html = renderRaceDetailLayoutPage(false);

        expect(html).toContain('"key":"time"');
        expect(html).toContain('"defaultLabel":"発走"');
        expect(html).toContain('"key":"condition"');
        expect(html).toContain('id="preview-race-select"');
        expect(html).toContain('id="apply-button"');
    });

    it('4: 使い方の説明・プレビュー用レース選択欄が含まれていること', () => {
        const html = renderRaceDetailLayoutPage(false);

        expect(html).toContain('class="usage-steps"');
        expect(html).toContain('プレビュー用レース');
        expect(html).toContain('class="apply-warning"');
        expect(html).not.toContain('id="preview-race-id"');
    });

    it('5: 未保存離脱ガード（beforeunload・dirtyトラッキング）が含まれていること', () => {
        const html = renderRaceDetailLayoutPage(false);

        expect(html).toContain("window.addEventListener('beforeunload'");
        expect(html).toContain("tbodyEl.addEventListener('change', markDirty)");
        expect(html).toContain("tbodyEl.addEventListener('input', markDirty)");
        expect(html).toContain('dirty = false;');
    });
});
