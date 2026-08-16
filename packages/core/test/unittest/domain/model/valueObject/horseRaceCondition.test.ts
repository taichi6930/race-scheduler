/**
 * HorseRaceConditionのテスト
 */
import { describe, expect, it } from 'bun:test';

import {
    HorseRaceConditionSchema,
    validateHorseRaceCondition,
} from '../../../../../src/domain/model/valueObject/horseRaceCondition';

/**
 * デシジョンテーブル: validateHorseRaceCondition
 *
 * | # | 条件                      | surfaceType | distance | 期待結果 |
 * |----|--------------------------|-------------|----------|----------|
 * | 1  | 通常値（芝）              | '芝'         | 1600     | 成功     |
 * | 2  | 通常値（ダート）           | 'ダート'     | 1400     | 成功     |
 * | 3  | 通常値（障害）             | '障害'       | 3000     | 成功     |
 * | 4  | 通常値（AW）              | 'AW'         | 1200     | 成功     |
 * | 5  | 通常値（不明）             | '不明'       | 800      | 成功     |
 * | 6  | distance=1（最小正の整数） | '芝'         | 1        | 成功     |
 * | 7  | 無効なsurfaceType         | '無効'       | 1600     | エラー   |
 * | 8  | 空文字surfaceType         | ''           | 1600     | エラー   |
 * | 9  | distance=0               | '芝'         | 0        | エラー   |
 * | 10 | distance=-1              | '芝'         | -1       | エラー   |
 * | 11 | surfaceTypeなし           | undefined    | 1600     | エラー   |
 * | 12 | distanceなし              | '芝'         | undefined| エラー   |
 */
describe('validateHorseRaceCondition', () => {
    describe('有効なHorseRaceConditionの場合、バリデーションが成功する', () => {
        describe('各surfaceTypeの通常値', () => {
            it.each([
                { surfaceType: '芝', distance: 1600 },
                { surfaceType: 'ダート', distance: 1400 },
                { surfaceType: '障害', distance: 3000 },
                { surfaceType: 'AW', distance: 1200 },
                { surfaceType: '不明', distance: 800 },
            ])(
                'surfaceType=$surfaceType, distance=$distance でバリデーションを通過する',
                (input) => {
                    const result = validateHorseRaceCondition(input);
                    expect(result).toEqual(input);
                },
            );
        });

        describe('distanceの境界値', () => {
            it('distance=1（最小正の整数）でバリデーションを通過する', () => {
                const input = { surfaceType: '芝', distance: 1 };
                const result = validateHorseRaceCondition(input);
                expect(result).toEqual(input);
            });

            it.each([100, 1000, 2000, 3200, 4000])(
                'distance=%d でバリデーションを通過する',
                (distance) => {
                    const input = { surfaceType: 'ダート', distance };
                    const result = validateHorseRaceCondition(input);
                    expect(result).toEqual(input);
                },
            );
        });
    });

    describe('無効なHorseRaceConditionの場合、バリデーションが失敗する', () => {
        describe('surfaceTypeが無効な値', () => {
            it('無効なsurfaceType はエラーになる', () => {
                const input = { surfaceType: '無効', distance: 1600 };
                expect(() => validateHorseRaceCondition(input)).toThrow(
                    '有効な馬場種別ではありません',
                );
            });

            it('空文字のsurfaceType はエラーになる', () => {
                const input = { surfaceType: '', distance: 1600 };
                expect(() => validateHorseRaceCondition(input)).toThrow(
                    '有効な馬場種別ではありません',
                );
            });

            it.each(['草', '砂', 'TURF'])(
                'surfaceType="%s" はエラーになる',
                (surfaceType) => {
                    const input = { surfaceType, distance: 1600 };
                    expect(() => validateHorseRaceCondition(input)).toThrow(
                        '有効な馬場種別ではありません',
                    );
                },
            );

            it('surfaceType が undefined はエラーになる', () => {
                const input = { surfaceType: undefined, distance: 1600 };
                expect(() => validateHorseRaceCondition(input)).toThrow();
            });
        });

        describe('distanceが無効な値', () => {
            it('distance=0 はエラーになる', () => {
                const input = { surfaceType: '芝', distance: 0 };
                expect(() => validateHorseRaceCondition(input)).toThrow(
                    '距離は0よりも大きい必要があります',
                );
            });

            it('distance=-1 はエラーになる', () => {
                const input = { surfaceType: '芝', distance: -1 };
                expect(() => validateHorseRaceCondition(input)).toThrow(
                    '距離は0よりも大きい必要があります',
                );
            });

            it.each([-100, -1000])('distance=%d はエラーになる', (distance) => {
                const input = { surfaceType: 'ダート', distance };
                expect(() => validateHorseRaceCondition(input)).toThrow(
                    '距離は0よりも大きい必要があります',
                );
            });

            it('distance が undefined はエラーになる', () => {
                const input = { surfaceType: '芝', distance: undefined };
                expect(() => validateHorseRaceCondition(input)).toThrow();
            });
        });

        describe('フィールド自体が欠落している場合', () => {
            it('空オブジェクト {} はエラーになる', () => {
                expect(() => validateHorseRaceCondition({})).toThrow();
            });

            it('null はエラーになる', () => {
                expect(() => validateHorseRaceCondition(null)).toThrow();
            });

            it('undefined はエラーになる', () => {
                expect(() => validateHorseRaceCondition(undefined)).toThrow();
            });
        });
    });

    describe('RaceConditionDataSchemaで直接パースする', () => {
        it('有効なデータをパースできる', () => {
            const input = { surfaceType: '芝', distance: 1600 };
            const result = HorseRaceConditionSchema.safeParse(input);
            expect(result.success).toBe(true);
        });

        it('無効なデータはパースに失敗する', () => {
            const input = { surfaceType: '無効', distance: -1 };
            const result = HorseRaceConditionSchema.safeParse(input);
            expect(result.success).toBe(false);
        });
    });
});
