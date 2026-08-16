import { describe, expect, it } from 'bun:test';

import { HeldDayTimesSchema } from '../../../../../src/domain/model/valueObject/heldDayTimes';

/**
 * HeldDayTimesSchemaのテスト
 *
 * ## デシジョンテーブル
 *
 * | #    | 入力  | 期待結果 |
 * |------|-------|----------|
 * | T-01 | 0（下限未満） | エラー   |
 * | T-02 | 1（下限）     | 成功     |
 * | T-03 | 99（上限）    | 成功     |
 * | T-04 | 100（上限超過）| エラー   |
 * | T-05 | 1.5（非整数） | エラー   |
 * | T-06 | '1'（非数値・文字列） | エラー |
 */
describe('HeldDayTimesSchema', () => {
    describe('1〜99の整数の場合、バリデーションが成功する', () => {
        it('[T-02] heldDayTimes=1（下限）はバリデーションを通過し、入力値がそのまま返る', () => {
            const result = HeldDayTimesSchema.safeParse(1);

            expect(result.success).toBe(true);
            expect(result.success && result.data).toBe(1);
        });

        it('[T-03] heldDayTimes=99（上限）はバリデーションを通過し、入力値がそのまま返る', () => {
            const result = HeldDayTimesSchema.safeParse(99);

            expect(result.success).toBe(true);
            expect(result.success && result.data).toBe(99);
        });
    });

    describe('範囲外・非整数・非数値の場合、バリデーションが失敗する', () => {
        it('[T-01] heldDayTimes=0（下限未満）はエラーになる', () => {
            const result = HeldDayTimesSchema.safeParse(0);

            expect(result.success).toBe(false);
        });

        it('[T-04] heldDayTimes=100（上限超過）はエラーになる', () => {
            const result = HeldDayTimesSchema.safeParse(100);

            expect(result.success).toBe(false);
        });

        it('[T-05] heldDayTimes=1.5（非整数）はエラーになる', () => {
            const result = HeldDayTimesSchema.safeParse(1.5);

            expect(result.success).toBe(false);
        });

        it('[T-06] heldDayTimes="1"（非数値・文字列）はエラーになる', () => {
            const result = HeldDayTimesSchema.safeParse('1');

            expect(result.success).toBe(false);
        });
    });
});
