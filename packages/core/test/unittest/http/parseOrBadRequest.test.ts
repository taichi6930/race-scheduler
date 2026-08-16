/**
 * controller/parseOrBadRequest ユーティリティテスト
 *
 * ## デシジョンテーブル（parseOrBadRequest）
 *
 * | #    | parse() の挙動                       | 期待結果                                              |
 * |------|--------------------------------------|------------------------------------------------------|
 * | T-01 | 正常に値を返す                       | { ok: true, value }                                  |
 * | T-02 | ValidationError を throw             | { ok: false, response }（badRequest / status を反映）|
 * | T-03 | ValidationError 以外の Error を throw | 例外を再スロー                                        |
 */

import { describe, expect, it } from 'bun:test';
import { badRequest, ValidationError } from '@race-schedule/core';

import { parseOrBadRequest } from '../../../src/http/parseOrBadRequest';

describe('parseOrBadRequest', () => {
    // T-01: parse が正常に値を返す → ok:true
    it('parseOrBadRequest_正常値を返す_okTrueと値を返すこと', () => {
        // Arrange
        const parse = (): number => 42;

        // Act
        const result = parseOrBadRequest(parse);

        // Assert
        expect(result).toEqual({ ok: true, value: 42 });
    });

    // T-02: ValidationError → ok:false + badRequest レスポンス（status 反映）
    it('parseOrBadRequest_ValidationErrorをthrow_okFalseとbadRequestレスポンスを返すこと', async () => {
        // Arrange
        const parse = (): number => {
            throw new ValidationError('不正な入力です', 422);
        };

        // Act
        const result = parseOrBadRequest(parse);

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            const expected = badRequest('不正な入力です', 422);
            expect(result.response.status).toBe(expected.status);
            expect(await result.response.text()).toBe(await expected.text());
        }
    });

    // T-03: 非 ValidationError → 再スロー
    it('parseOrBadRequest_ValidationError以外をthrow_例外を再スローすること', () => {
        // Arrange
        const parse = (): number => {
            throw new Error('想定外エラー');
        };

        // Act & Assert
        expect(() => parseOrBadRequest(parse)).toThrow('想定外エラー');
    });
});
