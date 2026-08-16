/**
 * timingSafeEqualString のデシジョンテーブル（SECAUTH-01）
 *
 * | #    | a                | b                | 期待   |
 * | ---- | ----------------- | ----------------- | ------ |
 * | T-01 | 'secret-token'     | 'secret-token'     | true   |
 * | T-02 | 'secret-token'     | 'different-token'  | false  |
 * | T-03 | 'short'            | 'much-longer-value'| false  |
 * | T-04 | ''                 | ''                 | true   |
 * | T-05 | ''                 | 'non-empty'        | false  |
 * | T-06 | 'トークン値'        | 'トークン値'        | true   |
 */

import { describe, expect, it } from 'bun:test';

import { timingSafeEqualString } from '../../../src/utilities/timingSafeEqual';

describe('timingSafeEqualString', () => {
    it('[T-01] 同一文字列_trueを返す', async () => {
        const result = await timingSafeEqualString(
            'secret-token',
            'secret-token',
        );

        expect(result).toBe(true);
    });

    it('[T-02] 異なる文字列_falseを返す', async () => {
        const result = await timingSafeEqualString(
            'secret-token',
            'different-token',
        );

        expect(result).toBe(false);
    });

    it('[T-03] 長さが異なる文字列_falseを返す', async () => {
        const result = await timingSafeEqualString(
            'short',
            'much-longer-value',
        );

        expect(result).toBe(false);
    });

    it('[T-04] 空文字同士_trueを返す', async () => {
        const result = await timingSafeEqualString('', '');

        expect(result).toBe(true);
    });

    it('[T-05] 片方が空文字_falseを返す', async () => {
        const result = await timingSafeEqualString('', 'non-empty');

        expect(result).toBe(false);
    });

    it('[T-06] マルチバイト文字の同一文字列_trueを返す', async () => {
        const result = await timingSafeEqualString('トークン値', 'トークン値');

        expect(result).toBe(true);
    });
});
