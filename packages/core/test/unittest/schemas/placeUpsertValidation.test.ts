/**
 * placeUpsertValidation テスト
 *
 * ## デシジョンテーブル: parsePlaceEntityUpsert
 *
 * | # | raceType  | placeHeldDays | placeGrade  | 期待結果                            |
 * |---|-----------|---------------|-------------|-------------------------------------|
 * | 1 | jra       | あり          | あり        | パース成功                          |
 * | 2 | nar       | なし          | なし        | パース成功（JRA以外はplaceHeldDays不要）|
 * | 3 | keirin    | なし          | 'GP'        | パース成功（mechanicalはplaceGrade必須）|
 * | 4 | jra       | なし          | 'GⅠ'        | エラー（JRAはplaceHeldDays必須）     |
 * | 5 | keirin    | なし          | なし        | エラー（mechanicalはplaceGrade必須）  |
 * | 6 | 不正raceType | -           | -           | エラー（raceType不正）              |
 * | 7 | (空配列)  | -             | -           | エラー（1件以上必要）               |
 * | 8 | jra       | あり          | datestring  | パース成功（datetime文字列→Date変換）|
 * | 10 | jra      | あり          | あり        | 同一placeId重複時は後勝ちで一意化される（VAL-05） |
 */

import { describe, expect, it, spyOn } from 'bun:test';
import type { ZodString } from 'zod';
import * as gradeTypeModule from '../../../src/domain/model/valueObject/gradeType';
import { validateLocationCode } from '../../../src/domain/model/valueObject/locationCode';
import * as raceCourseModule from '../../../src/domain/model/valueObject/raceCourse';
import { RaceType } from '../../../src/domain/model/valueObject/raceType';
import { parsePlaceEntityUpsert } from '../../../src/schemas/placeUpsertValidation';
import { appLogger } from '../../../src/utilities/appLogger';
import { ValidationError } from '../../../src/utilities/validationError';

/** JRA の有効なアップサート入力 */
const VALID_JRA_ITEM = {
    placeId: 'jra2026012705',
    locationCode: '05',
    raceType: RaceType.JRA,
    datetime: new Date('2026-01-27T00:00:00Z'),
    raceCourse: '東京',
    placeGrade: 'GⅠ',
    placeHeldDays: { heldTimes: 1, heldDayTimes: 1 },
};

/** NAR の有効なアップサート入力 */
const VALID_NAR_ITEM = {
    placeId: 'nar2026012701',
    locationCode: '01',
    raceType: RaceType.NAR,
    datetime: new Date('2026-01-27T00:00:00Z'),
    raceCourse: '北見ば',
};

/** KEIRIN の有効なアップサート入力 */
const VALID_KEIRIN_ITEM = {
    placeId: 'keirin2026012711',
    locationCode: '11',
    raceType: RaceType.KEIRIN,
    datetime: new Date('2026-01-27T00:00:00Z'),
    raceCourse: '函館',
    placeGrade: 'GP',
};

describe('parsePlaceEntityUpsert', () => {
    describe('正常系', () => {
        it('ケース#1: JRA（placeHeldDaysあり）でパース成功', () => {
            // Arrange
            const input = [VALID_JRA_ITEM];

            // Act
            const result = parsePlaceEntityUpsert(input);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]?.raceType).toBe(RaceType.JRA);
            expect(result[0]?.locationCode).toBe(validateLocationCode('05'));
        });

        it('ケース#2: NAR（placeHeldDaysなし）でパース成功', () => {
            // Arrange
            const input = [VALID_NAR_ITEM];

            // Act
            const result = parsePlaceEntityUpsert(input);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]?.raceType).toBe(RaceType.NAR);
        });

        it('ケース#9: NAR で isRaceListAvailable を保持してパース成功', () => {
            // Arrange: VAL-05のdedupeで一意化されないよう2件目のplaceIdを変える
            const input = [
                { ...VALID_NAR_ITEM, isRaceListAvailable: true },
                {
                    ...VALID_NAR_ITEM,
                    placeId: 'nar2026012801',
                    isRaceListAvailable: false,
                },
            ];

            // Act
            const result = parsePlaceEntityUpsert(input);

            // Assert: isRaceListAvailable が捨てられずに保持される
            expect(result[0]?.isRaceListAvailable).toBe(true);
            expect(result[1]?.isRaceListAvailable).toBe(false);
        });

        it('ケース#3: KEIRIN（placeGradeあり）でパース成功', () => {
            // Arrange
            const input = [VALID_KEIRIN_ITEM];

            // Act
            const result = parsePlaceEntityUpsert(input);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]?.raceType).toBe(RaceType.KEIRIN);
            expect(result[0]?.placeGrade).toBe('GP');
        });

        it('ケース#8: datetime が文字列でも Date に変換される', () => {
            // Arrange
            const input = [
                {
                    ...VALID_JRA_ITEM,
                    datetime: '2026-01-27T00:00:00.000Z', // 文字列
                },
            ];

            // Act
            const result = parsePlaceEntityUpsert(input);

            // Assert: datetime は Date 型に変換されている
            expect(result[0]?.datetime).toBeInstanceOf(Date);
        });

        it('複数アイテムが一括でパースできる', () => {
            // Arrange
            const input = [VALID_JRA_ITEM, VALID_NAR_ITEM];

            // Act
            const result = parsePlaceEntityUpsert(input);

            // Assert
            expect(result).toHaveLength(2);
        });

        it('ケース#10: 同一placeIdが重複する場合、後勝ちで一意化され警告ログが出ること（VAL-05）', () => {
            // Arrange: 2番目(index=1)がindex=0と同じplaceIdで、raceCourseのみ異なる
            const warnSpy = spyOn(appLogger, 'warn');
            const input = [
                VALID_JRA_ITEM,
                { ...VALID_JRA_ITEM, raceCourse: '中山' },
            ];

            try {
                // Act
                const result = parsePlaceEntityUpsert(input);

                // Assert: 後に出現した要素（raceCourse='中山'）のみが採用される
                expect(result).toHaveLength(1);
                expect(result[0]?.raceCourse).toBe('中山');
                expect(warnSpy).toHaveBeenCalledWith(
                    expect.stringContaining('placeIdが重複しています'),
                );
            } finally {
                warnSpy.mockRestore();
            }
        });
    });

    describe('異常系', () => {
        it('ケース#4: JRA で placeHeldDays がない場合エラー', () => {
            // Arrange
            const input = [
                {
                    ...VALID_JRA_ITEM,
                    placeHeldDays: undefined,
                },
            ];

            // Act & Assert
            expect(() => parsePlaceEntityUpsert(input)).toThrow(
                ValidationError,
            );
        });

        it('ケース#5: KEIRIN で placeGrade がない場合エラー', () => {
            // Arrange
            const input = [
                {
                    ...VALID_KEIRIN_ITEM,
                    placeGrade: undefined,
                },
            ];

            // Act & Assert
            expect(() => parsePlaceEntityUpsert(input)).toThrow(
                ValidationError,
            );
        });

        it('ケース#6: 無効な raceType はエラー', () => {
            // Arrange
            const input = [
                {
                    ...VALID_JRA_ITEM,
                    raceType: 'invalid_race',
                },
            ];

            // Act & Assert
            expect(() => parsePlaceEntityUpsert(input)).toThrow();
        });

        it('ケース#7: 空配列はエラー（1件以上必要）', () => {
            // Act & Assert
            expect(() => parsePlaceEntityUpsert([])).toThrow();
        });

        it('非配列の入力はエラー', () => {
            // Act & Assert
            expect(() => parsePlaceEntityUpsert(null)).toThrow();
            expect(() => parsePlaceEntityUpsert({})).toThrow();
        });

        it('配列要素エラーの場合、ValidationError に index が設定される', () => {
            // Arrange: 2番目(index=1)の要素が不正
            const input = [
                VALID_JRA_ITEM,
                {
                    ...VALID_KEIRIN_ITEM,
                    placeGrade: undefined, // KEIRIN で placeGrade なし
                },
            ];

            // Act & Assert
            try {
                parsePlaceEntityUpsert(input);
                throw new Error('Should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(ValidationError);
                const err = e as ValidationError;
                expect(err.index).toBe(1);
            }
        });

        it('プレースグレード非ZodError例外処理（カバレッジ用）', () => {
            // Arrange
            const input = [VALID_JRA_ITEM];

            // Mock: GradeTypeSchema を非ZodError をスロー
            const mockSchema = {
                parse: () => {
                    throw new Error('Unexpected non-ZodError');
                },
            };
            const spy = spyOn(
                gradeTypeModule,
                'GradeTypeSchema',
            ).mockReturnValue(mockSchema as unknown as ZodString);

            // Act & Assert
            // zodErrorMessage(非ZodError, 'Invalid grade') は常にfallbackの
            // 'Invalid grade' を返す（raceInvariants.ts参照）。そのメッセージが
            // ValidationError.messageまで正しく伝播することを実値で検証する。
            try {
                try {
                    parsePlaceEntityUpsert(input);
                    throw new Error('Should have thrown');
                } catch (e) {
                    expect(e).toBeInstanceOf(ValidationError);
                    const err = e as ValidationError;
                    expect(err.message).toBe('Invalid grade');
                    expect(err.index).toBe(0);
                }
            } finally {
                spy.mockRestore();
            }
        });

        it('レースコース非ZodError例外処理（カバレッジ用）', () => {
            // Arrange
            const input = [VALID_JRA_ITEM];

            // Mock: RaceCourseSchema を非ZodError をスロー
            const mockSchema = {
                parse: () => {
                    throw new Error('Unexpected non-ZodError');
                },
            };
            const spy = spyOn(
                raceCourseModule,
                'RaceCourseSchema',
            ).mockReturnValue(mockSchema as unknown as ZodString);

            // Act & Assert
            // zodErrorMessage(非ZodError, 'Invalid race course') のfallbackが
            // ValidationError.messageまで正しく伝播することを実値で検証する。
            try {
                try {
                    parsePlaceEntityUpsert(input);
                    throw new Error('Should have thrown');
                } catch (e) {
                    expect(e).toBeInstanceOf(ValidationError);
                    const err = e as ValidationError;
                    expect(err.message).toBe('Invalid race course');
                    expect(err.index).toBe(0);
                }
            } finally {
                spy.mockRestore();
            }
        });
    });
});
