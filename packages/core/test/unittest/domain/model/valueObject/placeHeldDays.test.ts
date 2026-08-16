/**
 * PlaceHeldDaysのテスト
 */
import { describe, expect, it } from 'bun:test';

import {
    PlaceHeldDaysSchema,
    validatePlaceHeldDays,
} from '../../../../../src/domain/model/valueObject/placeHeldDays';

/**
 * デシジョンテーブル: validatePlaceHeldDays
 *
 * | # | 条件 | heldTimes | heldDayTimes | 期待結果 |
 * |----|------|-----------|--------------|----------|
 * | 1 | 最小値 | 1 | 1 | 成功 |
 * | 2 | 通常値 | 12 | 8 | 成功 |
 * | 3 | 大きな値 | 365 | 365 | 成功 |
 * | 4 | heldTimes=0 | 0 | 1 | エラー |
 * | 5 | heldDayTimes=0 | 1 | 0 | エラー |
 * | 6 | heldTimes=-1 | -1 | 1 | エラー |
 * | 7 | heldDayTimes=-1 | 1 | -1 | エラー |
 * | 8 | heldTimes=小数 | 1.5 | 1 | エラー |
 * | 9 | heldDayTimes=小数 | 1 | 1.5 | エラー |
 * | 10 | heldTimesなし | undefined | 1 | エラー |
 * | 11 | heldDayTimesなし | 1 | undefined | エラー |
 * | 12 | heldTimes=上限（99） | 99 | 1 | 成功 |
 * | 13 | heldDayTimes=上限（99） | 1 | 99 | 成功 |
 * | 14 | heldTimes=上限超過（100） | 100 | 1 | エラー |
 * | 15 | heldDayTimes=上限超過（100） | 1 | 100 | エラー |
 */
describe('validatePlaceHeldDays', () => {
    describe('有効なPlaceHeldDaysの場合、バリデーションが成功する', () => {
        describe('最小値とその周辺', () => {
            it('最小値（1, 1）でバリデーションを通過する', () => {
                const input = {
                    heldTimes: 1,
                    heldDayTimes: 1,
                };
                const result = validatePlaceHeldDays(input);
                expect(result).toEqual(input);
            });

            it('最小値近辺（2, 2）でバリデーションを通過する', () => {
                const input = {
                    heldTimes: 2,
                    heldDayTimes: 2,
                };
                const result = validatePlaceHeldDays(input);
                expect(result).toEqual(input);
            });
        });

        describe('通常値', () => {
            it.each([
                {
                    heldTimes: 12,
                    heldDayTimes: 8,
                },
                {
                    heldTimes: 24,
                    heldDayTimes: 12,
                },
                {
                    heldTimes: 99,
                    heldDayTimes: 50,
                },
            ])(
                'heldTimes=$heldTimes, heldDayTimes=$heldDayTimes でバリデーションを通過する',
                (input) => {
                    const result = validatePlaceHeldDays(input);
                    expect(result).toEqual(input);
                },
            );
        });

        describe('上限値', () => {
            it('heldTimesが上限（99）でバリデーションを通過する', () => {
                const input = {
                    heldTimes: 99,
                    heldDayTimes: 1,
                };
                const result = validatePlaceHeldDays(input);
                expect(result).toEqual(input);
            });

            it('heldDayTimesが上限（99）でバリデーションを通過する', () => {
                const input = {
                    heldTimes: 1,
                    heldDayTimes: 99,
                };
                const result = validatePlaceHeldDays(input);
                expect(result).toEqual(input);
            });
        });
    });

    describe('無効なPlaceHeldDaysの場合、バリデーションが失敗する', () => {
        describe('heldTimesが無効な値', () => {
            it('heldTimes=0 はエラーになる', () => {
                const input = {
                    heldTimes: 0,
                    heldDayTimes: 1,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow(
                    '開催回数は1以上である必要があります',
                );
            });

            it('heldTimes=-1 はエラーになる', () => {
                const input = {
                    heldTimes: -1,
                    heldDayTimes: 1,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow(
                    '開催回数は1以上である必要があります',
                );
            });

            it.each([-10, -100])('heldTimes=%d はエラーになる', (heldTimes) => {
                const input = {
                    heldTimes,
                    heldDayTimes: 1,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow(
                    '開催回数は1以上である必要があります',
                );
            });

            it('heldTimes=1.5（小数）はエラーになる', () => {
                const input = {
                    heldTimes: 1.5,
                    heldDayTimes: 1,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow();
            });

            it('heldTimes=100（上限超過）はエラーになる', () => {
                const input = {
                    heldTimes: 100,
                    heldDayTimes: 1,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow(
                    '開催回数は99以下である必要があります',
                );
            });
        });

        describe('heldDayTimesが無効な値', () => {
            it('heldDayTimes=0 はエラーになる', () => {
                const input = {
                    heldTimes: 1,
                    heldDayTimes: 0,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow(
                    '開催日数は1以上である必要があります',
                );
            });

            it('heldDayTimes=-1 はエラーになる', () => {
                const input = {
                    heldTimes: 1,
                    heldDayTimes: -1,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow(
                    '開催日数は1以上である必要があります',
                );
            });

            it.each([-10, -100])(
                'heldDayTimes=%d はエラーになる',
                (heldDayTimes) => {
                    const input = {
                        heldTimes: 1,
                        heldDayTimes,
                    };
                    expect(() => validatePlaceHeldDays(input)).toThrow(
                        '開催日数は1以上である必要があります',
                    );
                },
            );

            it('heldDayTimes=1.5（小数）はエラーになる', () => {
                const input = {
                    heldTimes: 1,
                    heldDayTimes: 1.5,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow();
            });

            it('heldDayTimes=100（上限超過）はエラーになる', () => {
                const input = {
                    heldTimes: 1,
                    heldDayTimes: 100,
                };
                expect(() => validatePlaceHeldDays(input)).toThrow(
                    '開催日数は99以下である必要があります',
                );
            });
        });

        describe('必須フィールドが欠落している', () => {
            it('heldTimes が無い場合はエラーになる', () => {
                const input = {
                    heldDayTimes: 1,
                } as unknown;
                expect(() => validatePlaceHeldDays(input)).toThrow();
            });

            it('heldDayTimes が無い場合はエラーになる', () => {
                const input = {
                    heldTimes: 1,
                } as unknown;
                expect(() => validatePlaceHeldDays(input)).toThrow();
            });

            it('両方欠落している場合はエラーになる', () => {
                const input = {} as unknown;
                expect(() => validatePlaceHeldDays(input)).toThrow();
            });
        });

        describe('予期しないフィールドは無視される', () => {
            it('追加のフィールドは無視される', () => {
                const input = {
                    heldTimes: 1,
                    heldDayTimes: 1,
                    extraField: 'should be ignored',
                } as unknown;
                const result = validatePlaceHeldDays(input);
                expect(result).toEqual({
                    heldTimes: 1,
                    heldDayTimes: 1,
                });
            });
        });
    });

    describe('PlaceHeldDaysSchema', () => {
        it('スキーマによるparse()は validatePlaceHeldDays と同じ結果を返す', () => {
            const input = {
                heldTimes: 12,
                heldDayTimes: 8,
            };
            const result1 = PlaceHeldDaysSchema.parse(input);
            const result2 = validatePlaceHeldDays(input);
            expect(result1).toEqual(result2);
        });

        it('スキーマによるsafeParse()を使うと、成功時は success: true を返す', () => {
            const input = {
                heldTimes: 12,
                heldDayTimes: 8,
            };
            const result = PlaceHeldDaysSchema.safeParse(input);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(input);
            }
        });

        it('スキーマによるsafeParse()を使うと、失敗時は success: false を返す', () => {
            const input = {
                heldTimes: 0,
                heldDayTimes: 8,
            };
            const result = PlaceHeldDaysSchema.safeParse(input);
            expect(result.success).toBe(false);
        });
    });
});
