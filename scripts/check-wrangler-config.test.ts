/**
 * check-wrangler-config.ts の自己テスト（CFARCH-02）
 *
 * ## デシジョンテーブル
 *
 * ### resolvePlaceholders
 * | # | tomlContent | 期待 |
 * |---|-------------|------|
 * | T-01 | `${CLOUDFLARE_ACCOUNT_ID}` を含む | ダミー値に置換される |
 * | T-02 | `${DB_ID}` を含む（複数箇所） | 全箇所がダミー値に置換される |
 * | T-03 | プレースホルダを含まない | そのまま返す |
 *
 * ### findInheritanceWarnings
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-04 | CFARCH-01相当の警告文言を含む出力 | 該当行を検知する |
 * | T-05 | 警告を含まない正常な出力 | 空配列を返す |
 * | T-06 | 警告が複数行に渡る出力 | 該当箇所のみ抽出する |
 *
 * ### extractCompatibilityDate
 * | # | tomlContent | 期待 |
 * |---|-------------|------|
 * | T-07 | トップレベルに `compatibility_date` を含む | 値を抽出する |
 * | T-08 | `compatibility_date` を含まない | null を返す |
 *
 * ### findCompatibilityDateMismatches（QSYNC-06）
 * | # | dates | 期待 |
 * |---|-------|------|
 * | T-09 | 全パッケージ同じ日付 | 空配列（不一致なし） |
 * | T-10 | 1パッケージだけ異なる日付 | 全パッケージ分のメッセージを返す |
 * | T-11 | 抽出できなかった（null）パッケージを含む | nullも不一致として扱いメッセージに含める |
 */
import { describe, expect, it } from 'bun:test';

import {
    extractCompatibilityDate,
    findCompatibilityDateMismatches,
    findInheritanceWarnings,
    resolvePlaceholders,
} from './check-wrangler-config';

describe('resolvePlaceholders', () => {
    it('T-01_CLOUDFLARE_ACCOUNT_IDプレースホルダ_ダミー値に置換される', () => {
        const result = resolvePlaceholders(
            'account_id = "${CLOUDFLARE_ACCOUNT_ID}"',
        );

        expect(result).toBe('account_id = "0123456789abcdef0123456789abcdef"');
    });

    it('T-02_DB_IDプレースホルダが複数箇所_全箇所が置換される', () => {
        const result = resolvePlaceholders(
            'database_id = "${DB_ID}"\ndatabase_id = "${DB_ID}"',
        );

        expect(result).toBe(
            'database_id = "11111111-2222-3333-4444-555555555555"\ndatabase_id = "11111111-2222-3333-4444-555555555555"',
        );
    });

    it('T-03_プレースホルダを含まない場合_そのまま返す', () => {
        const result = resolvePlaceholders('name = "race-schedule-api"');

        expect(result).toBe('name = "race-schedule-api"');
    });
});

describe('findInheritanceWarnings', () => {
    it('T-04_CFARCH-01相当の警告文言を含む出力_該当行を検知する', () => {
        const output = [
            '- "env.production" environment configuration',
            '  - "ratelimits" exists at the top level, but not on "env.production".',
            '    This is not what you probably want, since "ratelimits" is not inherited by environments.',
            '    Please add "ratelimits" to "env.production".',
        ].join('\n');

        const result = findInheritanceWarnings(output);

        expect(result).toHaveLength(1);
        expect(result[0]).toContain('is not inherited by environments');
    });

    it('T-05_警告を含まない正常な出力_空配列を返す', () => {
        const output = [
            'Total Upload: 1366.57 KiB / gzip: 235.05 KiB',
            'Your Worker has access to the following bindings:',
            '--dry-run: exiting now.',
        ].join('\n');

        const result = findInheritanceWarnings(output);

        expect(result).toEqual([]);
    });

    it('T-06_警告が複数箇所にある出力_該当箇所のみ抽出する', () => {
        const output = [
            '  - "ratelimits" is not inherited by environments (env.production)',
            '  - "d1_databases" is not inherited by environments (env.test)',
            '  - some other unrelated warning line',
        ].join('\n');

        const result = findInheritanceWarnings(output);

        expect(result).toHaveLength(2);
    });
});

describe('extractCompatibilityDate', () => {
    it('T-07_トップレベルにcompatibility_dateを含む_値を抽出する', () => {
        const toml = [
            'name = "race-schedule-api"',
            'compatibility_date = "2026-01-01"',
            '',
            '[env.production]',
        ].join('\n');

        expect(extractCompatibilityDate(toml)).toBe('2026-01-01');
    });

    it('T-08_compatibility_dateを含まない_nullを返す', () => {
        const toml = 'name = "race-schedule-api"';

        expect(extractCompatibilityDate(toml)).toBeNull();
    });
});

describe('findCompatibilityDateMismatches', () => {
    it('T-09_全パッケージ同じ日付_空配列を返す', () => {
        const result = findCompatibilityDateMismatches([
            ['api', '2026-01-01'],
            ['batch', '2026-01-01'],
        ]);

        expect(result).toEqual([]);
    });

    it('T-10_1パッケージだけ異なる日付_全パッケージ分のメッセージを返す', () => {
        const result = findCompatibilityDateMismatches([
            ['api', '2026-01-01'],
            ['batch', '2026-02-01'],
        ]);

        expect(result).toHaveLength(2);
        expect(result[0]).toContain('packages/api/wrangler.toml');
        expect(result[0]).toContain('2026-01-01');
        expect(result[1]).toContain('packages/batch/wrangler.toml');
        expect(result[1]).toContain('2026-02-01');
    });

    it('T-11_抽出できなかったパッケージを含む_nullも不一致として扱う', () => {
        const result = findCompatibilityDateMismatches([
            ['api', '2026-01-01'],
            ['batch', null],
        ]);

        expect(result).toHaveLength(2);
        expect(result[1]).toContain('見つかりません');
    });
});
