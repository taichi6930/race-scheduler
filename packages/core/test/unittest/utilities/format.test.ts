/**
 * format ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | formatMonthDigits | Date, digit | padded month | Line |
 * | 2  | formatDayDigits | Date, digit | padded day | Line |
 * | 3  | toXDigits | value, digit | padded number | Line |
 * | 4  | replaceFromCodePoint | string, regex | converted string | Line |
 * | 4b | replaceFromCodePoint | 空文字列にマッチする正規表現 | RangeError（フォールバック分岐） | Branch |
 * | 5  | normalizeToHalfWidth | 全角英数字記号を含む文字列 | 半角に変換された文字列 | Line |
 * | 5b | normalizeToHalfWidth | 空文字列 / 全角スペース(U+3000) | エッジケース挙動 | Branch |
 */

import { describe, expect, it } from 'bun:test';
import {
    formatDayDigits,
    formatMonthDigits,
    normalizeToHalfWidth,
    replaceFromCodePoint,
    toXDigits,
} from '@race-schedule/core';

describe('format Utilities', () => {
    const testDate = new Date('2024-02-15T14:30:00Z');

    describe('formatMonthDigits', () => {
        it('月をパディングしてフォーマット（2桁）', () => {
            // testDate は 2024-02-15T14:30:00Z = JST 2024-02-15 23:30（月=2）
            const result = formatMonthDigits(testDate, 2);
            expect(result).toBe('02');
        });

        it('月をパディングしてフォーマット（1桁指定時は2桁の値がそのまま維持される）', () => {
            const result = formatMonthDigits(testDate, 1);
            expect(result).toBe('2');
        });

        it('異なる月でも機能', () => {
            const jan = new Date('2024-01-15');
            const dec = new Date('2024-12-15');

            const resultJan = formatMonthDigits(jan, 2);
            const resultDec = formatMonthDigits(dec, 2);

            expect(resultJan).toBe('01');
            expect(resultDec).toBe('12');
        });
    });

    describe('formatDayDigits', () => {
        it('日をパディングしてフォーマット', () => {
            // testDate は JST 2024-02-15（日=15）
            const result = formatDayDigits(testDate, 2);
            expect(result).toBe('15');
        });

        it('1桁指定でも2桁の値はパディングされずそのまま維持される', () => {
            const result = formatDayDigits(testDate, 1);
            expect(result).toBe('15');
        });
    });

    describe('toXDigits', () => {
        it('数値をパディング（2桁）', () => {
            const result = toXDigits(5, 2);
            expect(result).toBe('05');
        });

        it('数値をパディング（3桁）', () => {
            const result = toXDigits(42, 3);
            expect(result).toBe('042');
        });

        it('既に大きい数値はそのまま', () => {
            const result = toXDigits(123, 2);
            expect(result).toBe('123');
        });

        it('ゼロをパディング', () => {
            const result = toXDigits(0, 4);
            expect(result).toBe('0000');
        });
    });

    describe('replaceFromCodePoint', () => {
        it('全角文字を半角に変換', () => {
            const input = 'ＴＥＳＴ'; // 全角英字
            const result = replaceFromCodePoint(input, /./g);
            expect(result).toBe('TEST'); // 半角に変換される
        });

        it('マッチした最初の1文字だけ半角に変換される（global無し）', () => {
            const input = 'ＨＥＬＬＯ'; // 全角英字
            const result = replaceFromCodePoint(input, /Ｈ/);
            expect(result).toBe('HＥＬＬＯ'); // 先頭のみ変換、残りは全角のまま
        });

        it('マッチが空文字列の場合、codePointAtがundefinedとなりフォールバック(0)経由でRangeErrorを投げる', () => {
            // (?:) は空文字列にマッチするため s.codePointAt(0) は undefined になり、
            // `?? 0` フォールバックで `String.fromCodePoint(0 - 0xfee0)` という不正なコードポイントを
            // 生成しようとして RangeError になる（このユーティリティが空文字マッチを想定していない証跡）。
            expect(() => replaceFromCodePoint('abc', /(?:)/)).toThrow(
                RangeError,
            );
        });
    });

    describe('normalizeToHalfWidth', () => {
        it('全角英数字・記号を半角に変換', () => {
            const result = normalizeToHalfWidth('Ｇ１ＴＥＳＴ');
            expect(result).toBe('G1TEST');
        });

        it('半角文字はそのまま維持される', () => {
            const result = normalizeToHalfWidth('S級決勝');
            expect(result).toBe('S級決勝');
        });

        it('空文字列はそのまま空文字列を返す', () => {
            const result = normalizeToHalfWidth('');
            expect(result).toBe('');
        });

        it('全角スペース（U+3000）は変換対象外（FF01-FF5Eの範囲外）のためそのまま維持される', () => {
            const result = normalizeToHalfWidth('Ａ　Ｂ');
            expect(result).toBe('A　B');
        });
    });
});
