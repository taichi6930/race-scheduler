/**
 * domain/model/valueObject/playerNumber テスト
 *
 * ## デシジョンテーブル: PlayerNumberSchema.safeParse(value)
 *
 * PlayerNumberSchema は下限（1以上）のみを持つ整数スキーマで、上限値の制約は無い。
 *
 * | #    | value              | 期待               |
 * |------|--------------------|--------------------|
 * | T-01 | 0                  | NG（1未満）        |
 * | T-02 | 1                  | OK（下限）         |
 * | T-03 | 999999             | OK（上限なし）      |
 * | T-04 | 1.5                | NG（非整数）        |
 * | T-05 | -1                 | NG（負数）          |
 * | T-06 | '1'（非数値・文字列） | NG（非数値）        |
 *
 * ## デシジョンテーブル: PlayerNumberSchema.parse(value) のエラーメッセージ
 *
 * | #    | value | 期待メッセージ                        |
 * |------|-------|----------------------------------------|
 * | T-07 | 0     | '選手番号は1以上である必要があります'   |
 */
import { describe, expect, it } from 'bun:test';

import { PlayerNumberSchema } from '../../../../../src/domain/model/valueObject/playerNumber';

describe('PlayerNumberSchema', () => {
    describe('境界値・非整数・非数値の検証', () => {
        it.each([
            ['[T-01] 0 → NG（1未満）', 0, false],
            ['[T-02] 1（下限）→ OK', 1, true],
            ['[T-03] 999999（上限なし）→ OK', 999_999, true],
            ['[T-04] 1.5（非整数）→ NG', 1.5, false],
            ['[T-05] -1（負数）→ NG', -1, false],
        ])('%s', (_title, value, expectedSuccess) => {
            const result = PlayerNumberSchema.safeParse(value);

            expect(result.success).toBe(expectedSuccess);
        });

        it("[T-06] '1'（非数値・文字列）→ NG", () => {
            const result = PlayerNumberSchema.safeParse('1');

            expect(result.success).toBe(false);
        });
    });

    describe('エラーメッセージの検証', () => {
        it('[T-07] 0（下限未満）→ 下限エラーメッセージ', () => {
            expect(() => PlayerNumberSchema.parse(0)).toThrow(
                '選手番号は1以上である必要があります',
            );
        });
    });
});
