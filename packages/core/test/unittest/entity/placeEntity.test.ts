/**
 * placeEntity テスト
 *
 * ## デシジョンテーブル: validatePlaceEntity
 *
 * | # | raceType  | placeGrade  | raceCourse(raceType整合) | 期待結果                              |
 * |---|-----------|-------------|--------------------------|---------------------------------------|
 * | 1 | jra       | 'GⅠ'        | '東京'                   | パース成功                            |
 * | 2 | nar       | なし        | '北見ば'                 | パース成功                            |
 * | 3 | keirin    | 'GP'        | '函館'                   | パース成功                            |
 * | 4 | keirin    | なし        | '函館'                   | エラー（mechanicalはplaceGrade必須）  |
 * | 5 | jra       | なし        | '東京'                   | パース成功（JRAはplaceGrade任意）     |
 * | 6 | jra       | 'GⅠ'        | '北見ば'（NAR場名）      | エラー（JRAにNARのcourse不一致）      |
 *
 * ## デシジョンテーブル: generatePlaceEntity
 *
 * | # | raceType | locationCode | placeGrade | 期待結果                              |
 * |---|----------|--------------|------------|---------------------------------------|
 * | 7 | jra      | '05'         | undefined  | PlaceEntity生成成功（raceCourse='東京'）|
 * | 8 | keirin   | '11'         | 'GP'       | PlaceEntity生成成功（raceCourse='函館'）|
 * | 9 | jra      | '99'（無効）  | undefined  | エラー（Invalid location code）       |
 */

import { describe, expect, it, spyOn } from 'bun:test';
import type { ZodString } from 'zod';
import * as gradeTypeModule from '../../../src/domain/model/valueObject/gradeType';
import { validateLocationCode } from '../../../src/domain/model/valueObject/locationCode';
import { RaceType } from '../../../src/domain/model/valueObject/raceType';
import {
    generatePlaceEntity,
    validatePlaceEntity,
} from '../../../src/entity/placeEntity';

describe('validatePlaceEntity', () => {
    describe('正常系', () => {
        it('ケース#1: JRA（placeGradeあり・任意）で成功', () => {
            // Arrange
            const entity = {
                placeId: 'jra2026012705',
                raceType: RaceType.JRA,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '東京',
                locationCode: '05',
                placeGrade: 'GⅠ',
            };

            // Act
            const result = validatePlaceEntity(entity);

            // Assert
            expect(result.raceType).toBe(RaceType.JRA);
            expect(result.raceCourse).toBe('東京');
            expect(result.placeGrade).toBe('GⅠ');
        });

        it('ケース#2: NAR（placeGradeなし）で成功', () => {
            // Arrange
            const entity = {
                placeId: 'nar2026012701',
                raceType: RaceType.NAR,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '北見ば',
                locationCode: '01',
            };

            // Act
            const result = validatePlaceEntity(entity);

            // Assert
            expect(result.raceType).toBe(RaceType.NAR);
            expect(result.placeGrade).toBeUndefined();
        });

        it('ケース#3: KEIRIN（placeGradeあり）で成功', () => {
            // Arrange
            const entity = {
                placeId: 'keirin2026012711',
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '函館',
                locationCode: '11',
                placeGrade: 'GP',
            };

            // Act
            const result = validatePlaceEntity(entity);

            // Assert
            expect(result.raceType).toBe(RaceType.KEIRIN);
            expect(result.placeGrade).toBe('GP');
        });

        it('ケース#6: NAR で isRaceListAvailable を保持して成功', () => {
            // Arrange
            const entity = {
                placeId: 'nar2026012701',
                raceType: RaceType.NAR,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '北見ば',
                locationCode: '01',
                isRaceListAvailable: true,
            };

            // Act
            const result = validatePlaceEntity(entity);

            // Assert
            expect(result.isRaceListAvailable).toBe(true);
        });

        it('ケース#5: JRA は placeGrade なしでも成功', () => {
            // Arrange
            const entity = {
                placeId: 'jra2026012705',
                raceType: RaceType.JRA,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '東京',
                locationCode: '05',
            };

            // Act
            const result = validatePlaceEntity(entity);

            // Assert
            expect(result.placeGrade).toBeUndefined();
        });
    });

    describe('異常系', () => {
        it('ケース#4: KEIRIN で placeGrade なしはエラー', () => {
            // Arrange
            const entity = {
                placeId: 'keirin2026012711',
                raceType: RaceType.KEIRIN,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '函館',
                locationCode: '11',
                // placeGrade なし
            };

            // Act & Assert: shouldHavePlaceGradeForMechanical違反（PLACE_GRADE_REQUIRED_ERROR）
            expect(() => validatePlaceEntity(entity)).toThrow(
                'placeGrade is required for KEIRIN/AUTORACE/BOATRACE',
            );
        });

        it('ケース#6: JRA で NAR の raceCourse はエラー', () => {
            // Arrange
            const entity = {
                placeId: 'jra2026012701',
                raceType: RaceType.JRA,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '北見ば', // NARの場名
                locationCode: '01',
            };

            // Act & Assert: raceCourseSuperRefine違反（RaceCourseSchemaのmessage生成関数）
            expect(() => validatePlaceEntity(entity)).toThrow(
                'jraの開催場ではありません',
            );
        });

        it('必須フィールドが欠落している場合はエラー', () => {
            // Arrange: raceType なし
            const entity = {
                placeId: 'jra2026012705',
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '東京',
                locationCode: '05',
            };

            // Act & Assert: raceType必須違反（RaceTypeSchemaのenumバリデーション）
            expect(() => validatePlaceEntity(entity)).toThrow(
                'Invalid option: expected one of',
            );
        });
    });
});

describe('generatePlaceEntity', () => {
    describe('正常系', () => {
        it('ケース#7: JRA・locationCode=05 から PlaceEntity を生成できる', () => {
            // Arrange
            const raceType = RaceType.JRA;
            const datetime = new Date('2026-01-27T00:00:00Z');
            const locationCode = validateLocationCode('05');

            // Act
            const result = generatePlaceEntity(
                raceType,
                datetime,
                locationCode,
                undefined,
                undefined,
            );

            // Assert
            expect(result.raceType).toBe(RaceType.JRA);
            expect(result.raceCourse).toBe('東京');
            expect(result.locationCode).toBe(validateLocationCode('05'));
            expect(result.placeId).toMatch(/^jra\d{8}05$/);
        });

        it('ケース#8: KEIRIN・locationCode=11・placeGrade=GP から PlaceEntity を生成できる', () => {
            // Arrange
            const raceType = RaceType.KEIRIN;
            const datetime = new Date('2026-01-27T00:00:00Z');

            // Act
            const result = generatePlaceEntity(
                raceType,
                datetime,
                validateLocationCode('11'),
                'GP',
                undefined,
            );

            // Assert
            expect(result.raceType).toBe(RaceType.KEIRIN);
            expect(result.raceCourse).toBe('函館');
            expect(result.placeGrade).toBe('GP');
        });
    });

    describe('異常系', () => {
        it('ケース#9: 無効な locationCode はエラー', () => {
            // Arrange
            const raceType = RaceType.JRA;
            const datetime = new Date('2026-01-27T00:00:00Z');

            // Act & Assert
            // locationCode '99' は JRA に存在しないため findPlaceNameByCode が null を返しエラーになる
            expect(() =>
                generatePlaceEntity(
                    raceType,
                    datetime,
                    validateLocationCode('99'),
                    undefined,
                    undefined,
                ),
            ).toThrow('Invalid location code');
        });

        it('プレースグレードバリデーション時の非ZodError例外処理', () => {
            // Arrange
            const entity = {
                placeId: 'jra2026012705',
                raceType: RaceType.JRA,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceCourse: '東京',
                locationCode: '05',
                placeGrade: 'GⅠ',
            };

            // Mock: GradeTypeSchema を非ZodErrorをスロー
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
            try {
                expect(() => validatePlaceEntity(entity)).toThrow();
            } finally {
                // Cleanup
                spy.mockRestore();
            }
        });
    });
});
