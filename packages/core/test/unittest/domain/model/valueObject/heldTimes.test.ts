import { describe, expect, it } from 'bun:test';

import { HeldTimesSchema } from '../../../../../src/domain/model/valueObject/heldTimes';

/**
 * HeldTimesSchemaのテスト
 *
 * ## デシジョンテーブル
 *
 * | #    | 入力                  | 期待結果 |
 * |------|-----------------------|----------|
 * | T-01 | 0（下限未満）          | エラー   |
 * | T-02 | 1（下限）              | 成功     |
 * | T-03 | 99（上限）             | 成功     |
 * | T-04 | 100（上限超過）        | エラー   |
 * | T-05 | 1.5（非整数）          | エラー   |
 * | T-06 | '1'（非数値・文字列）  | エラー   |
 */
describe('HeldTimesSchema', () => {
    it('[T-01] heldTimes=0（下限未満）はエラーになる', () => {
        const result = HeldTimesSchema.safeParse(0);

        expect(result.success).toBe(false);
    });

    it('[T-02] heldTimes=1（下限）はバリデーションを通過し、入力値がそのまま返る', () => {
        const result = HeldTimesSchema.safeParse(1);

        expect(result.success).toBe(true);
        expect(result.success && result.data).toBe(1);
    });

    it('[T-03] heldTimes=99（上限）はバリデーションを通過し、入力値がそのまま返る', () => {
        const result = HeldTimesSchema.safeParse(99);

        expect(result.success).toBe(true);
        expect(result.success && result.data).toBe(99);
    });

    it('[T-04] heldTimes=100（上限超過）はエラーになる', () => {
        const result = HeldTimesSchema.safeParse(100);

        expect(result.success).toBe(false);
    });

    it('[T-05] heldTimes=1.5（非整数）はエラーになる', () => {
        const result = HeldTimesSchema.safeParse(1.5);

        expect(result.success).toBe(false);
    });

    it("[T-06] heldTimes='1'（非数値・文字列）はエラーになる", () => {
        const result = HeldTimesSchema.safeParse('1');

        expect(result.success).toBe(false);
    });
});
