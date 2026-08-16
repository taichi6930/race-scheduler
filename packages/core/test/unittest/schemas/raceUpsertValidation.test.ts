/**
 * raceUpsertValidation テスト
 *
 * ## デシジョンテーブル: parseRaceEntityUpsert
 *
 * | # | raceType  | conditionData | raceStage    | placeHeldDays | 期待結果                            |
 * |---|-----------|---------------|--------------|---------------|-------------------------------------|
 * | 1 | jra       | あり          | なし         | あり          | パース成功                          |
 * | 2 | nar       | あり          | なし         | なし          | パース成功（NARはplaceHeldDays不要） |
 * | 3 | keirin    | なし          | 'S級決勝'    | なし          | パース成功                          |
 * | 4 | jra       | なし          | なし         | あり          | エラー（JRA/NAR/OVERSEASはconditionData必須）|
 * | 5 | keirin    | なし          | なし         | なし          | エラー（KEIRIN系はraceStage必須）    |
 * | 6 | jra       | あり          | なし         | なし          | エラー（JRAはplaceHeldDays必須）     |
 * | 7 | 不正raceType | -           | -            | -             | エラー                              |
 * | 8 | (空配列)  | -             | -            | -             | エラー（1件以上必要）               |
 * | 9 | jra       | あり          | -            | あり          | 同一raceId重複時は後勝ちで一意化される（VAL-05） |
 */

import { describe, expect, it, spyOn } from 'bun:test';
import type { ZodString } from 'zod';
import * as gradeTypeModule from '../../../src/domain/model/valueObject/gradeType';
import { validateLocationCode } from '../../../src/domain/model/valueObject/locationCode';
import * as raceCourseModule from '../../../src/domain/model/valueObject/raceCourse';
import { RaceType } from '../../../src/domain/model/valueObject/raceType';
import { parseRaceEntityUpsert } from '../../../src/schemas/raceUpsertValidation';
import { appLogger } from '../../../src/utilities/appLogger';
import { ValidationError } from '../../../src/utilities/validationError';

/** JRA の有効なアップサート入力 */
const VALID_JRA_ITEM = {
    raceId: 'jra202601270501',
    placeId: 'jra2026012705',
    raceType: RaceType.JRA,
    datetime: new Date('2026-01-27T00:00:00Z'),
    locationCode: '05',
    raceCourse: '東京',
    raceName: '有馬記念',
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2000 },
    raceNumber: 1,
    placeHeldDays: { heldTimes: 1, heldDayTimes: 1 },
};

/** NAR の有効なアップサート入力 */
const VALID_NAR_ITEM = {
    raceId: 'nar202601270101',
    placeId: 'nar2026012701',
    raceType: RaceType.NAR,
    datetime: new Date('2026-01-27T00:00:00Z'),
    locationCode: '01',
    raceCourse: '北見ば',
    raceName: '北見記念',
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: 'ダート', distance: 1600 },
    raceNumber: 1,
};

/** KEIRIN の有効なアップサート入力 */
const VALID_KEIRIN_ITEM = {
    raceId: 'keirin202601271101',
    placeId: 'keirin2026012711',
    raceType: RaceType.KEIRIN,
    datetime: new Date('2026-01-27T00:00:00Z'),
    locationCode: '11',
    raceCourse: '函館',
    raceName: 'グランプリ',
    raceGrade: 'GP',
    raceStage: 'S級決勝',
    raceNumber: 1,
};

describe('parseRaceEntityUpsert', () => {
    describe('正常系', () => {
        it('ケース#1: JRA（conditionData・placeHeldDaysあり）でパース成功', () => {
            // Arrange
            const input = [VALID_JRA_ITEM];

            // Act
            const result = parseRaceEntityUpsert(input);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]?.raceType).toBe(RaceType.JRA);
            expect(result[0]?.conditionData).toBeDefined();
        });

        it('ケース#2: NAR（placeHeldDaysなし）でパース成功', () => {
            // Arrange
            const input = [VALID_NAR_ITEM];

            // Act
            const result = parseRaceEntityUpsert(input);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]?.raceType).toBe(RaceType.NAR);
        });

        it('ケース#3: KEIRIN（raceStageあり）でパース成功', () => {
            // Arrange
            const input = [VALID_KEIRIN_ITEM];

            // Act
            const result = parseRaceEntityUpsert(input);

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]?.raceStage).toBe('S級決勝');
        });

        it('datetime が文字列でも Date に変換される', () => {
            // Arrange
            const input = [
                {
                    ...VALID_JRA_ITEM,
                    datetime: '2026-01-27T00:00:00.000Z', // 文字列
                },
            ];

            // Act
            const result = parseRaceEntityUpsert(input);

            // Assert: datetime は Date 型に変換されている
            expect(result[0]?.datetime).toBeInstanceOf(Date);
        });

        it('複数アイテムが一括でパースできる', () => {
            // Arrange
            const input = [VALID_JRA_ITEM, VALID_NAR_ITEM];

            // Act
            const result = parseRaceEntityUpsert(input);

            // Assert
            expect(result).toHaveLength(2);
        });

        it('ケース#9: 同一raceIdが重複する場合、後勝ちで一意化され警告ログが出ること（VAL-05）', () => {
            // Arrange: 2番目(index=1)がindex=0と同じraceIdで、locationCodeのみ異なる
            const warnSpy = spyOn(appLogger, 'warn');
            const input = [
                VALID_JRA_ITEM,
                { ...VALID_JRA_ITEM, locationCode: '06' },
            ];

            try {
                // Act
                const result = parseRaceEntityUpsert(input);

                // Assert: 後に出現した要素（locationCode='06'）のみが採用される
                expect(result).toHaveLength(1);
                expect(result[0]?.locationCode).toBe(
                    validateLocationCode('06'),
                );
                expect(warnSpy).toHaveBeenCalledWith(
                    expect.stringContaining('raceIdが重複しています'),
                );
            } finally {
                warnSpy.mockRestore();
            }
        });
    });

    describe('異常系', () => {
        it('ケース#4: JRA で conditionData がない場合エラー', () => {
            // Arrange
            const input = [
                {
                    ...VALID_JRA_ITEM,
                    conditionData: undefined,
                },
            ];

            // Act & Assert
            expect(() => parseRaceEntityUpsert(input)).toThrow();
        });

        it('ケース#5: KEIRIN で raceStage がない場合エラー', () => {
            // Arrange
            const input = [
                {
                    ...VALID_KEIRIN_ITEM,
                    raceStage: undefined,
                },
            ];

            // Act & Assert
            expect(() => parseRaceEntityUpsert(input)).toThrow();
        });

        it('ケース#6: JRA で placeHeldDays がない場合エラー', () => {
            // Arrange
            const input = [
                {
                    ...VALID_JRA_ITEM,
                    placeHeldDays: undefined,
                },
            ];

            // Act & Assert
            expect(() => parseRaceEntityUpsert(input)).toThrow();
        });

        it('ケース#7: 無効な raceType はエラー', () => {
            // Arrange
            const input = [
                {
                    ...VALID_JRA_ITEM,
                    raceType: 'invalid_type',
                },
            ];

            // Act & Assert
            expect(() => parseRaceEntityUpsert(input)).toThrow();
        });

        it('ケース#8: 空配列はエラー（1件以上必要）', () => {
            // Act & Assert
            expect(() => parseRaceEntityUpsert([])).toThrow();
        });

        it('非配列の入力はエラー', () => {
            // Act & Assert
            expect(() => parseRaceEntityUpsert(null)).toThrow();
        });

        it('配列要素エラーの場合、ValidationError に index が設定される', () => {
            // Arrange: 2番目(index=1)の要素が不正
            const input = [
                VALID_JRA_ITEM,
                {
                    ...VALID_KEIRIN_ITEM,
                    raceStage: undefined, // raceStage なし
                },
            ];

            // Act & Assert
            try {
                parseRaceEntityUpsert(input);
                throw new Error('Should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(ValidationError);
                const err = e as ValidationError;
                expect(err.index).toBe(1);
            }
        });

        it('レースグレード非ZodError例外処理（カバレッジ用）', () => {
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
                    parseRaceEntityUpsert(input);
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
                    parseRaceEntityUpsert(input);
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
