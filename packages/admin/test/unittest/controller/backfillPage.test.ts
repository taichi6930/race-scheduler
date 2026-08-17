/**
 * backfillPage.test.ts - renderBackfillPage ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | isProduction | 期待値                                                  |
 * |---|--------------|----------------------------------------------------------|
 * | 1 | false        | testのfavicon・「テスト環境」バッジ・全レース種別チェックボックス・IS_PRODUCTION=false |
 * | 2 | true         | productionのfavicon・「本番環境」バッジ・IS_PRODUCTION=true（本番confirm分岐が有効） |
 * | 3 | いずれも     | 結果/エラー領域にaria属性（role="alert"/role="status"）、キャッシュ無しキー一覧の折りたたみ表示、タイムアウト付きfetchのコードが含まれる |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { renderBackfillPage } from '../../../src/controller/backfillPage';
import {
    PRODUCTION_FAVICON_DATA_URI,
    TEST_FAVICON_DATA_URI,
} from '../../../src/controller/faviconAssets';

describe('admin/controller/renderBackfillPage', () => {
    it('1: isProduction=falseの場合はtest向けfavicon・バッジ・全レース種別のチェックボックス・IS_PRODUCTION=falseを返すこと', () => {
        const html = renderBackfillPage(false);

        expect(html).toContain(
            `<link rel="icon" href="${TEST_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge test">テスト環境');
        for (const raceType of Object.values(RaceType)) {
            expect(html).toContain(`value="${raceType}"`);
        }
        expect(html).toContain(`value="${RaceType.KEIRIN}" checked`);
        expect(html).not.toContain(PRODUCTION_FAVICON_DATA_URI);
        expect(html).toContain('var IS_PRODUCTION = false;');
    });

    it('2: isProduction=trueの場合はproduction向けfavicon・バッジ・IS_PRODUCTION=trueを返すこと', () => {
        const html = renderBackfillPage(true);

        expect(html).toContain(
            `<link rel="icon" href="${PRODUCTION_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge production">本番環境');
        expect(html).not.toContain(TEST_FAVICON_DATA_URI);
        expect(html).toContain('var IS_PRODUCTION = true;');
    });

    it('3: 結果/エラー領域のaria属性・スキップキーの折りたたみ表示・タイムアウト付きfetchが含まれること', () => {
        const html = renderBackfillPage(false);

        expect(html).toContain(
            '<p id="error" class="error" role="alert" tabindex="-1" hidden></p>',
        );
        expect(html).toContain(
            '<span id="running" class="hint" role="status" hidden>',
        );
        expect(html).toContain(
            '<div id="result" class="group" role="status" hidden>',
        );
        expect(html).toContain('errorEl.focus();');
        expect(html).toContain('function fetchWithTimeout(path, options)');
        expect(html).toContain('controller.abort();');
        expect(html).toContain(
            'function buildResultSummary(label, result, notCachedKey)',
        );
        expect(html).toContain("document.createElement('details')");
        expect(html).toContain(
            "window.confirm('本番環境のデータを書き換えます。実行しますか？')",
        );
    });
});
