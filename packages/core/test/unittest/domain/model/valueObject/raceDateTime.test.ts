import { describe, expect, it } from 'bun:test';

import { RaceDateTimeSchema } from '../../../../../src/domain/model/valueObject/raceDateTime';

/**
 * RaceDateTimeSchemaのテスト
 *
 * ## デシジョンテーブル
 *
 * | #    | 入力                                    | 期待結果 |
 * | ---- | --------------------------------------- | -------- |
 * | T-01 | 有効なDate（`new Date()`）              | 成功     |
 * | T-02 | 無効なDate（`new Date('invalid-date')`）| エラー   |
 * | T-03 | 文字列（`'2024-01-01'`）                | エラー   |
 * | T-04 | 数値（タイムスタンプ）                  | エラー   |
 * | T-05 | null                                    | エラー   |
 * | T-06 | undefined                               | エラー   |
 */
describe('RaceDateTimeSchema', () => {
    it('[T-01] 有効なDateの場合、バリデーションが成功し入力値がそのまま返る', () => {
        const raceDateTime = new Date('2024-01-01T00:00:00Z');

        const result = RaceDateTimeSchema.safeParse(raceDateTime);

        expect(result.success).toBe(true);
        expect(result.success && result.data).toBe(raceDateTime);
    });

    it('[T-02] 無効なDate（Invalid Date）の場合、バリデーションが失敗する', () => {
        const invalidDate = new Date('invalid-date');

        const result = RaceDateTimeSchema.safeParse(invalidDate);

        expect(result.success).toBe(false);
    });

    it('[T-03] 文字列の場合、バリデーションが失敗する', () => {
        const result = RaceDateTimeSchema.safeParse('2024-01-01');

        expect(result.success).toBe(false);
    });

    it('[T-04] 数値（タイムスタンプ）の場合、バリデーションが失敗する', () => {
        const result = RaceDateTimeSchema.safeParse(1_704_067_200_000);

        expect(result.success).toBe(false);
    });

    it('[T-05] nullの場合、バリデーションが失敗する', () => {
        const result = RaceDateTimeSchema.safeParse(null);

        expect(result.success).toBe(false);
    });

    it('[T-06] undefinedの場合、バリデーションが失敗する', () => {
        const result = RaceDateTimeSchema.safeParse(undefined);

        expect(result.success).toBe(false);
    });
});
