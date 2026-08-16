import { describe, expect, it } from 'bun:test';

import { validateLocationCode } from '../../../../../src/domain/model/valueObject/locationCode';

/**
 * validateLocationCodeのテスト
 *
 * ## デシジョンテーブル
 *
 * | #    | 条件                     | 入力例 | 期待結果 |
 * |------|--------------------------|--------|----------|
 * | T-01 | 0埋め2桁の数字           | "01"   | 成功     |
 * | T-02 | 0埋め2桁の数字           | "09"   | 成功     |
 * | T-03 | 2桁の数字（0埋めなし）   | "10"   | 成功     |
 * | T-04 | 2桁の数字（0埋めなし）   | "99"   | 成功     |
 * | T-05 | 英字のみ                 | "ab"   | エラー   |
 * | T-06 | 英字混在                 | "1a"   | エラー   |
 * | T-07 | 3桁以上の数字            | "001"  | エラー   |
 * | T-08 | 3桁以上の数字            | "100"  | エラー   |
 * | T-09 | 1桁の数字                | "1"    | エラー   |
 * | T-10 | 1桁の数字                | "0"    | エラー   |
 */
describe('validateLocationCode', () => {
    describe('0埋め2桁の数字の場合、バリデーションが成功する', () => {
        it.each([
            [
                '[T-01] "01" はバリデーションを通過し、入力値がそのまま返る',
                '01',
            ],
            [
                '[T-02] "09" はバリデーションを通過し、入力値がそのまま返る',
                '09',
            ],
        ])('%s', (_title, code) => {
            const result = validateLocationCode(code);

            expect<string>(result).toBe(code);
        });
    });

    describe('2桁の数字（0埋めなし）の場合、バリデーションが成功する', () => {
        it.each([
            [
                '[T-03] "10" はバリデーションを通過し、入力値がそのまま返る',
                '10',
            ],
            [
                '[T-04] "99" はバリデーションを通過し、入力値がそのまま返る',
                '99',
            ],
        ])('%s', (_title, code) => {
            const result = validateLocationCode(code);

            expect<string>(result).toBe(code);
        });
    });

    describe('英字が含まれる場合、バリデーションが失敗する', () => {
        it.each([
            ['[T-05] "ab"（英字のみ）はエラーになる', 'ab'],
            ['[T-06] "1a"（英字混在）はエラーになる', '1a'],
        ])('%s', (_title, code) => {
            expect(() => validateLocationCode(code)).toThrow();
        });
    });

    describe('3桁以上の場合、バリデーションが失敗する', () => {
        it.each([
            ['[T-07] "001"（3桁）はエラーになる', '001'],
            ['[T-08] "100"（3桁）はエラーになる', '100'],
        ])('%s', (_title, code) => {
            expect(() => validateLocationCode(code)).toThrow();
        });
    });

    describe('1桁の場合、バリデーションが失敗する', () => {
        it.each([
            ['[T-09] "1"（1桁）はエラーになる', '1'],
            ['[T-10] "0"（1桁）はエラーになる', '0'],
        ])('%s', (_title, code) => {
            expect(() => validateLocationCode(code)).toThrow();
        });
    });
});
