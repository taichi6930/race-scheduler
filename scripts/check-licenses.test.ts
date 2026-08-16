/**
 * check-licenses.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * ライセンス許可/不許可判定のロジックを誤って実装するとGPL系ライセンスの
 * 混入を見逃す、あるいは正当な依存関係を誤ってブロックするため、UTを用意する
 * （OPS-03）。`bunx license-checker` の実行自体はネットワーク・環境依存のため
 * ここでは検証しない。
 *
 * ## デシジョンテーブル
 *
 * ### isDisallowed
 * | # | license | 期待 |
 * |---|---------|------|
 * | T-01 | 'MIT' | 許可（false） |
 * | T-02 | 'Apache-2.0' | 許可（false） |
 * | T-03 | 'ISC' | 許可（false） |
 * | T-04 | 'MIT OR Apache-2.0' | 許可（false） |
 * | T-05 | 'GPL-3.0' | 不許可（true） |
 * | T-06 | 'AGPL-3.0' | 不許可（true） |
 * | T-07 | 'LGPL-2.1' | 不許可（true） |
 * | T-08 | 'SSPL-1.0' | 不許可（true） |
 * | T-09 | 'UNKNOWN' | 不許可（true） |
 *
 * ### licenseStrings
 * | # | licenses | 期待 |
 * |---|----------|------|
 * | T-10 | undefined | ['UNKNOWN'] |
 * | T-11 | 'MIT'（文字列） | ['MIT'] |
 * | T-12 | ['MIT', 'Apache-2.0']（配列） | そのまま |
 *
 * ### findViolations
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-13 | 全パッケージが許可ライセンス | 空配列 |
 * | T-14 | 1件がGPL | その1件だけを違反として返す |
 */
import { describe, expect, it } from 'bun:test';

import { findViolations, isDisallowed, licenseStrings } from './check-licenses';

describe('isDisallowed', () => {
    it.each([
        ['[T-01] MIT', 'MIT', false],
        ['[T-02] Apache-2.0', 'Apache-2.0', false],
        ['[T-03] ISC', 'ISC', false],
        ['[T-04] MIT OR Apache-2.0', 'MIT OR Apache-2.0', false],
        ['[T-05] GPL-3.0', 'GPL-3.0', true],
        ['[T-06] AGPL-3.0', 'AGPL-3.0', true],
        ['[T-07] LGPL-2.1', 'LGPL-2.1', true],
        ['[T-08] SSPL-1.0', 'SSPL-1.0', true],
        ['[T-09] UNKNOWN', 'UNKNOWN', true],
    ])('%s', (_label, license, expected) => {
        expect(isDisallowed(license)).toBe(expected);
    });
});

describe('licenseStrings', () => {
    it('[T-10] undefined_UNKNOWN一件の配列を返す', () => {
        expect(licenseStrings(undefined)).toEqual(['UNKNOWN']);
    });

    it('[T-11] 文字列_一件の配列に包む', () => {
        expect(licenseStrings('MIT')).toEqual(['MIT']);
    });

    it('[T-12] 配列_そのまま返す', () => {
        expect(licenseStrings(['MIT', 'Apache-2.0'])).toEqual([
            'MIT',
            'Apache-2.0',
        ]);
    });
});

describe('findViolations', () => {
    it('[T-13] 全パッケージが許可ライセンス_空配列を返す', () => {
        const result = findViolations('packages/api', {
            foo: { licenses: 'MIT' },
            bar: { licenses: 'Apache-2.0' },
        });

        expect(result).toEqual([]);
    });

    it('[T-14] 1件がGPL_その1件だけを違反として返す', () => {
        const result = findViolations('packages/api', {
            foo: { licenses: 'MIT' },
            bad: { licenses: 'GPL-3.0' },
        });

        expect(result).toEqual([
            { dir: 'packages/api', packageName: 'bad', license: 'GPL-3.0' },
        ]);
    });
});
