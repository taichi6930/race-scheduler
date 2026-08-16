/**
 * backfillPage.test.ts - renderBackfillPage ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | isProduction | 期待値                                                  |
 * |---|--------------|----------------------------------------------------------|
 * | 1 | false        | testのfavicon・「テスト環境」バッジ・全レース種別チェックボックス |
 * | 2 | true         | productionのfavicon・「本番環境」バッジ                   |
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
    it('1: isProduction=falseの場合はtest向けfavicon・バッジ・全レース種別のチェックボックスを返すこと', () => {
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
    });

    it('2: isProduction=trueの場合はproduction向けfavicon・バッジを返すこと', () => {
        const html = renderBackfillPage(true);

        expect(html).toContain(
            `<link rel="icon" href="${PRODUCTION_FAVICON_DATA_URI}">`,
        );
        expect(html).toContain('env-badge production">本番環境');
        expect(html).not.toContain(TEST_FAVICON_DATA_URI);
    });
});
