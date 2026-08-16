/**
 * validation ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | isValidHtmlString | 有効な文字列 | true | Line |
 * | 2  | isValidHtmlString | 空文字列 | false | Branch |
 * | 3  | isValidHtmlString | 空白のみ | false | Branch |
 * | 4  | isValidHtmlString | 非文字列型 | false | Branch |
 * | 5  | isValidHtmlString | null/undefined | false | Branch |
 */

import { describe, expect, it } from 'bun:test';

import { isValidHtmlString } from '../../../src/utilities/validation';

describe('validation', () => {
    describe('isValidHtmlString', () => {
        it('有効な HTML 文字列を true と判定', () => {
            const result = isValidHtmlString('Hello World');

            expect(result).toBe(true);
        });

        it('特殊文字を含む HTML 文字列を true と判定', () => {
            const result = isValidHtmlString('<div>Content</div>');

            expect(result).toBe(true);
        });

        it('数字を含む文字列を true と判定', () => {
            const result = isValidHtmlString('Test123');

            expect(result).toBe(true);
        });

        it('日本語を含む文字列を true と判定', () => {
            const result = isValidHtmlString('テスト');

            expect(result).toBe(true);
        });

        it('1文字だけの文字列を true と判定', () => {
            const result = isValidHtmlString('A');

            expect(result).toBe(true);
        });

        it('空白を含む有効な文字列を true と判定', () => {
            const result = isValidHtmlString('Hello  World');

            expect(result).toBe(true);
        });

        it('改行を含む文字列を true と判定', () => {
            const result = isValidHtmlString('Line1\nLine2');

            expect(result).toBe(true);
        });

        it('tab を含む文字列を true と判定', () => {
            const result = isValidHtmlString('Before\tAfter');

            expect(result).toBe(true);
        });

        it('空文字列を false と判定', () => {
            const result = isValidHtmlString('');

            expect(result).toBe(false);
        });

        it('空白のみの文字列を false と判定', () => {
            const result = isValidHtmlString('   ');

            expect(result).toBe(false);
        });

        it('改行のみを false と判定', () => {
            const result = isValidHtmlString('\n');

            expect(result).toBe(false);
        });

        it('tab のみを false と判定', () => {
            const result = isValidHtmlString('\t');

            expect(result).toBe(false);
        });

        it('複数の空白文字のみを false と判定', () => {
            const result = isValidHtmlString('   \n\t   ');

            expect(result).toBe(false);
        });

        it('数値型を false と判定', () => {
            const result = isValidHtmlString(123);

            expect(result).toBe(false);
        });

        it('boolean 型を false と判定', () => {
            const result = isValidHtmlString(true);

            expect(result).toBe(false);
        });

        it('オブジェクト型を false と判定', () => {
            const result = isValidHtmlString({});

            expect(result).toBe(false);
        });

        it('配列型を false と判定', () => {
            const result = isValidHtmlString([]);

            expect(result).toBe(false);
        });

        it('null を false と判定', () => {
            const result = isValidHtmlString(null);

            expect(result).toBe(false);
        });

        it('undefined を false と判定', () => {
            const result = isValidHtmlString(undefined);

            expect(result).toBe(false);
        });

        it('Symbol 型を false と判定', () => {
            const result = isValidHtmlString(Symbol('test'));

            expect(result).toBe(false);
        });

        it('関数型を false と判定', () => {
            const result = isValidHtmlString(() => {});

            expect(result).toBe(false);
        });

        it('返り値が boolean 型である', () => {
            const result = isValidHtmlString('test');

            expect(typeof result).toBe('boolean');
        });

        it('型ガード機能: true の場合、値は string 型として扱える', () => {
            const value: unknown = 'Hello';

            if (isValidHtmlString(value)) {
                // value は ここで string 型として型ガードされている
                const length: number = value.length;
                expect(length).toBe(5);
            }
        });

        it('型ガード機能: false の場合、値は string 型ではない', () => {
            const value: unknown = 123;

            if (!isValidHtmlString(value)) {
                // value は string ではない
                expect(typeof value).not.toBe('string');
            }
        });
    });
});
