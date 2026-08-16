/**
 * schemas/placeFilterValidation テスト
 *
 * ## デシジョンテーブル
 *
 * ### parseSearchPlaceFilterParams
 * | # | Input | 期待結果 | Coverage |
 * |----|-------|----------|----------|
 * | T-01 | 必須フィールドのみ（isDisplayPlaceGrade省略） | 正常パース、isDisplayPlaceGradeはundefined | Line |
 * | T-02 | 全フィールド指定（isDisplayPlaceGrade明示） | 正常パース | Branch |
 * | T-03 | raceTypeList なし | ValidationError | Branch |
 * | T-04 | startDate なし | ValidationError | Branch |
 * | T-05 | finishDate なし | ValidationError | Branch |
 * | T-06 | 無効なraceType | ValidationError | Branch |
 * | T-07 | raceTypeListにjra,narのカンマ区切り | 配列2件に変換 | Branch |
 * | T-08 | 余分なプロパティ（extraField） | ValidationError (strict) | Branch |
 */

import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@race-schedule/core';

import { parseSearchPlaceFilterParams } from '../../../src/schemas/placeFilterValidation';

const validInput = {
    startDate: new Date('2025-01-01'),
    finishDate: new Date('2025-01-31'),
    raceTypeList: 'jra',
};

describe('parseSearchPlaceFilterParams', () => {
    it('[T-01] 必須フィールドのみで正常パースする（isDisplayPlaceGradeは省略可能）', () => {
        const result = parseSearchPlaceFilterParams(validInput);

        expect(result.startDate).toBeInstanceOf(Date);
        expect(result.finishDate).toBeInstanceOf(Date);
        expect(result.raceTypeList).toContain('jra');
        expect(result.isDisplayPlaceGrade).toBeUndefined();
    });

    it('[T-02] 全フィールド指定で正常パースする', () => {
        const input = {
            ...validInput,
            locationList: ['tokyo', 'osaka'],
            isDisplayPlaceHeldDays: true,
            isDisplayPlaceGrade: false,
        };

        const result = parseSearchPlaceFilterParams(input);

        expect(result.locationList).toEqual(['tokyo', 'osaka']);
        expect(result.isDisplayPlaceHeldDays).toBe(true);
        expect(result.isDisplayPlaceGrade).toBe(false);
    });

    it('[T-03] raceTypeListが未指定の場合はValidationErrorを投げる', () => {
        const input = { startDate: new Date(), finishDate: new Date() };

        expect(() => parseSearchPlaceFilterParams(input)).toThrow(
            ValidationError,
        );
    });

    it('[T-04] startDateが未指定の場合はValidationErrorを投げる', () => {
        const input = {
            finishDate: new Date('2025-01-31'),
            raceTypeList: 'jra',
        };

        expect(() => parseSearchPlaceFilterParams(input)).toThrow(
            ValidationError,
        );
    });

    it('[T-05] finishDateが未指定の場合はValidationErrorを投げる', () => {
        const input = {
            startDate: new Date('2025-01-01'),
            raceTypeList: 'jra',
        };

        expect(() => parseSearchPlaceFilterParams(input)).toThrow(
            ValidationError,
        );
    });

    it('[T-06] 無効なraceTypeのみの場合はValidationErrorを投げる', () => {
        const input = {
            ...validInput,
            raceTypeList: 'invalid_type',
        };

        expect(() => parseSearchPlaceFilterParams(input)).toThrow(
            ValidationError,
        );
    });

    it('[T-07] raceTypeListにjraとnarを含む場合は正常パースする', () => {
        const input = { ...validInput, raceTypeList: 'jra,nar' };

        const result = parseSearchPlaceFilterParams(input);

        expect(result.raceTypeList).toHaveLength(2);
    });

    it('[T-08] 余分なフィールドがある場合はValidationErrorを投げる（strict）', () => {
        const input = { ...validInput, extraField: 'should_fail' };

        expect(() => parseSearchPlaceFilterParams(input)).toThrow(
            ValidationError,
        );
    });
});
