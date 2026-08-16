import { describe, expect, it } from 'bun:test';

import { RaceNumberSchema } from '../../../../../src/domain/model/valueObject/raceNumber';

/**
 * RaceNumberSchemaのテスト
 *
 * ## デシジョンテーブル
 *
 * | #    | 入力                  | 期待結果 |
 * |------|-----------------------|----------|
 * | T-01 | 1（下限）             | 成功     |
 * | T-02 | 12（上限）            | 成功     |
 * | T-03 | 6（中間値）           | 成功     |
 * | T-04 | 0（下限未満）         | エラー   |
 * | T-05 | 13（上限超過）        | エラー   |
 * | T-06 | -1（負数）            | エラー   |
 * | T-07 | 1.5（非整数）         | エラー   |
 * | T-08 | '1'（非数値・文字列） | エラー   |
 * | T-09 | 0（下限未満）         | エラーメッセージ「レース番号は1以上である必要があります」 |
 * | T-10 | 13（上限超過）        | エラーメッセージ「レース番号は12以下である必要があります」 |
 */
describe('RaceNumberSchema', () => {
    describe('1〜12の整数の場合、バリデーションが成功する', () => {
        it.each([
            ['[T-01] 1（下限）はバリデーションを通過する', 1],
            ['[T-02] 12（上限）はバリデーションを通過する', 12],
            ['[T-03] 6（中間値）はバリデーションを通過する', 6],
        ])('%s', (_title, raceNumber) => {
            const result = RaceNumberSchema.safeParse(raceNumber);

            expect(result.success).toBe(true);
            expect(result.success && result.data).toBe(raceNumber);
        });
    });

    describe('範囲外・非整数・非数値の場合、バリデーションが失敗する', () => {
        it.each([
            ['[T-04] 0（下限未満）はエラーになる', 0],
            ['[T-05] 13（上限超過）はエラーになる', 13],
            ['[T-06] -1（負数）はエラーになる', -1],
            ['[T-07] 1.5（非整数）はエラーになる', 1.5],
            ['[T-08] "1"（非数値・文字列）はエラーになる', '1'],
        ])('%s', (_title, raceNumber) => {
            const result = RaceNumberSchema.safeParse(raceNumber);

            expect(result.success).toBe(false);
        });
    });

    describe('エラーメッセージが上限・下限ごとに正しいこと', () => {
        it('[T-09] 0（下限未満）は下限エラーメッセージを返す', () => {
            expect(() => RaceNumberSchema.parse(0)).toThrow(
                'レース番号は1以上である必要があります',
            );
        });

        it('[T-10] 13（上限超過）は上限エラーメッセージを返す', () => {
            expect(() => RaceNumberSchema.parse(13)).toThrow(
                'レース番号は12以下である必要があります',
            );
        });
    });
});
