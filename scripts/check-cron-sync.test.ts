/**
 * check-cron-sync.ts の自己テスト（QSYNC-01）
 *
 * ## デシジョンテーブル
 *
 * ### extractProductionCrons
 * | # | wranglerContent | 期待 |
 * |---|-----------------|------|
 * | T-01 | `[env.production.triggers] crons = [...]` を含む | 各cron式を配列で返す |
 * | T-02 | 該当セクションを含まない | 空配列を返す |
 *
 * ### extractNamedCronConstants
 * | # | scheduledContent | 期待 |
 * |---|------------------|------|
 * | T-03 | `const XXX_CRON = '...';` を複数含む | 全ての値を配列で返す |
 * | T-04 | 該当する定数を含まない | 空配列を返す |
 *
 * ### findMissingCrons
 * | # | wranglerCrons | expectedCrons | 期待 |
 * |---|---------------|----------------|------|
 * | T-05 | 期待値を全て含む | 部分集合 | 空配列 |
 * | T-06 | 一部欠けている | 欠けている分を含む | 欠けているcron式のみ返す |
 */

import { describe, expect, it } from 'bun:test';

import {
    extractNamedCronConstants,
    extractProductionCrons,
    findMissingCrons,
} from './check-cron-sync';

describe('check-cron-sync/extractProductionCrons', () => {
    it('T-01: [env.production.triggers] crons を含む場合は各cron式を返すこと', () => {
        const content = `
[env.production.triggers]
crons = ["* * * * *", "0 5 * * *"]
`;

        expect(extractProductionCrons(content)).toEqual([
            '* * * * *',
            '0 5 * * *',
        ]);
    });

    it('T-02: 該当セクションを含まない場合は空配列を返すこと', () => {
        const content = '[env.development.triggers]\ncrons = ["*/5 * * * *"]';

        expect(extractProductionCrons(content)).toEqual([]);
    });
});

describe('check-cron-sync/extractNamedCronConstants', () => {
    it('T-03: 複数の名前付きcron定数を含む場合は全ての値を返すこと', () => {
        const content = `
const DATA_FRESHNESS_CRON = '0 5 * * *';
const UPTIME_CHECK_CRON = '*/15 * * * *';
`;

        expect(extractNamedCronConstants(content)).toEqual([
            '0 5 * * *',
            '*/15 * * * *',
        ]);
    });

    it('T-04: 該当する定数を含まない場合は空配列を返すこと', () => {
        expect(extractNamedCronConstants('const FOO = 1;')).toEqual([]);
    });
});

describe('check-cron-sync/findMissingCrons', () => {
    it('T-05: wranglerCronsが期待値を全て含む場合は空配列を返すこと', () => {
        const missing = findMissingCrons(
            ['* * * * *', '0 5 * * *', '0 * * * *'],
            ['* * * * *', '0 5 * * *'],
        );

        expect(missing).toEqual([]);
    });

    it('T-06: 一部欠けている場合は欠けているcron式のみ返すこと', () => {
        const missing = findMissingCrons(
            ['* * * * *'],
            ['* * * * *', '0 5 * * *', '*/15 * * * *'],
        );

        expect(missing).toEqual(['0 5 * * *', '*/15 * * * *']);
    });
});
