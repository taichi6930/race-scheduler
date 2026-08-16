/**
 * schemas/playerFilterValidation テスト
 *
 * ## デシジョンテーブル
 *
 * ### parseSearchPlayerFilterParams
 * | # | Input | 期待結果 | Coverage |
 * |----|-------|----------|----------|
 * | 1  | raceTypeList="keirin" | 正常パース | Line |
 * | 2  | raceTypeList="keirin,autorace" | 複数のraceTypeを返す | Branch |
 * | 3  | raceTypeList なし | ValidationError | Branch |
 * | 4  | 無効なraceType | ValidationError | Branch |
 * | 5  | 余分なフィールド有り | ValidationError (strict) | Branch |
 * | 6  | playerName="山田" | playerNameを保持して正常パース | Branch |
 * | 7  | playerName未指定 | playerNameがundefinedで正常パース | Branch |
 * | 8  | playerName="" (空文字) | ValidationError (min(1)) | Branch |
 */

import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@race-schedule/core';

import { parseSearchPlayerFilterParams } from '../../../src/schemas/playerFilterValidation';

describe('parseSearchPlayerFilterParams', () => {
    it('#1: 有効なraceTypeListで正常パースする', () => {
        const result = parseSearchPlayerFilterParams({
            raceTypeList: 'keirin',
        });

        expect(result.raceTypeList).toContain('keirin');
    });

    it('#2: 複数のraceTypeListを正常パースする', () => {
        const result = parseSearchPlayerFilterParams({
            raceTypeList: 'keirin,autorace',
        });

        expect(result.raceTypeList).toHaveLength(2);
        expect(result.raceTypeList).toContain('keirin');
        expect(result.raceTypeList).toContain('autorace');
    });

    it('#3: raceTypeListが未指定の場合はValidationErrorを投げる', () => {
        expect(() => parseSearchPlayerFilterParams({})).toThrow(
            ValidationError,
        );
    });

    it('#4: 無効なraceTypeのみの場合はValidationErrorを投げる', () => {
        expect(() =>
            parseSearchPlayerFilterParams({ raceTypeList: 'invalid_type' }),
        ).toThrow(ValidationError);
    });

    it('#5: 余分なフィールドがある場合はValidationErrorを投げる（strict）', () => {
        expect(() =>
            parseSearchPlayerFilterParams({
                raceTypeList: 'keirin',
                extraField: 'should_fail',
            }),
        ).toThrow(ValidationError);
    });

    it('raceTypeListにboatraceを指定できる', () => {
        const result = parseSearchPlayerFilterParams({
            raceTypeList: 'boatrace',
        });

        expect(result.raceTypeList).toContain('boatrace');
    });

    it('#6: playerNameを指定した場合そのまま保持して正常パースする', () => {
        const result = parseSearchPlayerFilterParams({
            raceTypeList: 'keirin',
            playerName: '山田',
        });

        expect(result.playerName).toBe('山田');
    });

    it('#7: playerName未指定の場合undefinedで正常パースする', () => {
        const result = parseSearchPlayerFilterParams({
            raceTypeList: 'keirin',
        });

        expect(result.playerName).toBeUndefined();
    });

    it('#8: playerNameが空文字の場合ValidationErrorを投げる', () => {
        expect(() =>
            parseSearchPlayerFilterParams({
                raceTypeList: 'keirin',
                playerName: '',
            }),
        ).toThrow(ValidationError);
    });
});
