/**
 * schemas/raceFilterValidation テスト
 *
 * ## デシジョンテーブル
 *
 * ### parseSearchRaceFilterParams
 * | # | Input | 期待結果 | Coverage |
 * |----|-------|----------|----------|
 * | T-01 | 必須フィールドのみ | 正常パース | Line |
 * | T-02 | 全フィールド指定 | 正常パース | Branch |
 * | T-03 | raceTypeList なし | ValidationError | Branch |
 * | T-04 | 無効なraceType | ValidationError | Branch |
 * | T-05 | locationList が文字列 | 配列に変換される | Branch |
 * | T-06 | gradeList が文字列 | 配列に変換される | Branch |
 * | T-07 | 余分なフィールド有り | ValidationError (strict) | Branch |
 * | T-08 | raceTypeList にカンマ区切り複数値 | 配列に変換される | Branch |
 */

import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@race-schedule/core';

import { parseSearchRaceFilterParams } from '../../../src/schemas/raceFilterValidation';

const validInput = {
    startDate: new Date('2025-01-01'),
    finishDate: new Date('2025-01-31'),
    raceTypeList: 'jra',
};

describe('parseSearchRaceFilterParams', () => {
    it('[T-01] 必須フィールドのみで正常パースする', () => {
        const result = parseSearchRaceFilterParams(validInput);

        expect(result.startDate).toBeInstanceOf(Date);
        expect(result.finishDate).toBeInstanceOf(Date);
        expect(result.raceTypeList).toContain('jra');
        expect(result.locationList).toBeUndefined();
        expect(result.gradeList).toBeUndefined();
    });

    it('[T-02] 全フィールド指定で正常パースする', () => {
        const input = {
            ...validInput,
            locationList: ['tokyo', 'osaka'],
            gradeList: ['G1', 'G2'],
            isDisplayPlaceHeldDays: true,
        };

        const result = parseSearchRaceFilterParams(input);

        expect(result.locationList).toEqual(['tokyo', 'osaka']);
        expect(result.gradeList).toEqual(['G1', 'G2']);
        expect(result.isDisplayPlaceHeldDays).toBe(true);
    });

    it('[T-03] raceTypeListが未指定の場合はValidationErrorを投げる', () => {
        const input = {
            startDate: new Date('2025-01-01'),
            finishDate: new Date('2025-01-31'),
        };

        expect(() => parseSearchRaceFilterParams(input)).toThrow(
            ValidationError,
        );
    });

    it('[T-04] 無効なraceTypeのみの場合はValidationErrorを投げる', () => {
        const input = { ...validInput, raceTypeList: 'unknown_type' };

        expect(() => parseSearchRaceFilterParams(input)).toThrow(
            ValidationError,
        );
    });

    it('[T-05] locationListが文字列の場合は配列に変換される', () => {
        const input = { ...validInput, locationList: 'tokyo' };

        const result = parseSearchRaceFilterParams(input);

        expect(result.locationList).toEqual(['tokyo']);
    });

    it('[T-06] gradeListが文字列の場合は配列に変換される', () => {
        const input = { ...validInput, gradeList: 'G1' };

        const result = parseSearchRaceFilterParams(input);

        expect(result.gradeList).toEqual(['G1']);
    });

    it('[T-07] 余分なフィールドがある場合はValidationErrorを投げる（strict）', () => {
        const input = { ...validInput, extraField: 'should_fail' };

        expect(() => parseSearchRaceFilterParams(input)).toThrow(
            ValidationError,
        );
    });

    it('[T-08] raceTypeListにカンマ区切り複数値を指定できる', () => {
        const input = { ...validInput, raceTypeList: 'jra,nar' };

        const result = parseSearchRaceFilterParams(input);

        expect(result.raceTypeList).toEqual(['jra', 'nar']);
    });
});
