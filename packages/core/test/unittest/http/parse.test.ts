/**
 * controller/parse ユーティリティ テスト
 *
 * ## デシジョンテーブル: parseCommonSearchParams
 *
 * | #    | startDate | finishDate | raceTypeList | locationList | 期待結果                         |
 * |------|-----------|-----------|--------------|--------------|----------------------------------|
 * | T-01 | 有効な日付 | 有効な日付 | "jra"        | なし         | CommonSearchParams を返す        |
 * | T-02 | 有効な日付 | 有効な日付 | "jra,nar"    | "tokyo,osaka"| raceTypeList/locationList を返す |
 * | T-03 | なし      | 有効な日付 | "jra"        | なし         | ValidationError(400)             |
 * | T-04 | 有効な日付 | なし      | "jra"        | なし         | ValidationError(400)             |
 * | T-05 | 有効な日付 | 有効な日付 | なし         | なし         | ValidationError(400)             |
 * | T-06 | "not-a-date" | 有効な日付 | "jra"     | なし         | ValidationError(400)             |
 * | T-07 | 有効な日付 | 有効な日付 | "invalid"    | なし         | ValidationError(400)             |
 * | T-08 | 有効な日付 | 有効な日付 | "jra"        | なし         | finishDate が JST 23:59:59       |
 * | T-09 | ISO文字列  | ISO文字列  | "jra"        | なし         | 正常にパース                     |
 * | T-16 | "2026-13-99"（YYYY-MM-DD形式だが無効な月日） | 有効な日付 | "jra" | なし | ValidationError(400) |
 *
 * ## デシジョンテーブル: parseRaceSearchParams
 *
 * | #    | placeIdList | placeHeldDaysMap | 期待結果                                |
 * |------|-------------|------------------|-----------------------------------------|
 * | T-10 | "p1,p2"     | なし             | placeIdList を返す                      |
 * | T-11 | なし        | なし             | ValidationError(400) placeIdListは必須  |
 * | T-12 | ""          | なし             | ValidationError(400) placeIdListは必須  |
 * | T-13 | ","         | なし             | ValidationError(400) 有効な値がありません |
 * | T-14 | "p1"        | valid JSON       | placeHeldDaysMap を返す                 |
 * | T-15 | "p1"        | invalid JSON     | placeHeldDaysMap = undefined            |
 */

import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@race-schedule/core';

import {
    parseCommonSearchParams,
    parseRaceSearchParams,
} from '../../../src/http/parse';

describe('parseCommonSearchParams', () => {
    it('[T-01] parseCommonSearchParams_有効な日付とraceTypeList_CommonSearchParamsを返す', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: '2025-01-01',
            finishDate: '2025-01-31',
            raceTypeList: 'jra',
        });

        // Act
        const result = parseCommonSearchParams(params);

        // Assert
        expect(result.startDate).toBeInstanceOf(Date);
        expect(result.finishDate).toBeInstanceOf(Date);
        expect(result.raceTypeList).toContain('jra');
        expect(result.locationList).toBeUndefined();
    });

    it('[T-02] parseCommonSearchParams_複数raceTypeListとlocationList_正しくパースする', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: '2025-01-01',
            finishDate: '2025-01-31',
            raceTypeList: 'jra,nar',
            locationList: 'tokyo,osaka',
        });

        // Act
        const result = parseCommonSearchParams(params);

        // Assert
        expect(result.raceTypeList).toHaveLength(2);
        expect(result.raceTypeList).toContain('jra');
        expect(result.raceTypeList).toContain('nar');
        expect(result.locationList).toEqual(['tokyo', 'osaka']);
    });

    it('[T-03] parseCommonSearchParams_startDate未指定_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({
            finishDate: '2025-01-31',
            raceTypeList: 'jra',
        });

        // Act & Assert
        expect(() => parseCommonSearchParams(params)).toThrow(ValidationError);
    });

    it('[T-04] parseCommonSearchParams_finishDate未指定_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: '2025-01-01',
            raceTypeList: 'jra',
        });

        // Act & Assert
        expect(() => parseCommonSearchParams(params)).toThrow(ValidationError);
    });

    it('[T-05] parseCommonSearchParams_raceTypeList未指定_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: '2025-01-01',
            finishDate: '2025-01-31',
        });

        // Act & Assert
        expect(() => parseCommonSearchParams(params)).toThrow(ValidationError);
    });

    it('[T-06] parseCommonSearchParams_無効な日付形式_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: 'not-a-date',
            finishDate: '2025-01-31',
            raceTypeList: 'jra',
        });

        // Act & Assert
        expect(() => parseCommonSearchParams(params)).toThrow(ValidationError);
    });

    it('[T-07] parseCommonSearchParams_無効なraceTypeのみ_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: '2025-01-01',
            finishDate: '2025-01-31',
            raceTypeList: 'invalid_type',
        });

        // Act & Assert
        expect(() => parseCommonSearchParams(params)).toThrow(ValidationError);
    });

    it('[T-08] parseCommonSearchParams_finishDate_JST23時59分59秒に設定される', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: '2025-01-01',
            finishDate: '2025-01-31',
            raceTypeList: 'jra',
        });

        // Act
        const result = parseCommonSearchParams(params);

        // Assert (JSTで23:59:59 = UTCで14:59:59)
        expect(result.finishDate.getUTCHours()).toBe(14);
        expect(result.finishDate.getUTCMinutes()).toBe(59);
        expect(result.finishDate.getUTCSeconds()).toBe(59);
    });

    it('[T-09] parseCommonSearchParams_YYYY-MM-DD以外の有効なISO日付_正常にパースする', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: '2025-01-01T09:00:00.000Z',
            finishDate: '2025-01-31T14:59:59.000Z',
            raceTypeList: 'jra',
        });

        // Act
        const result = parseCommonSearchParams(params);

        // Assert
        expect(result.startDate).toBeInstanceOf(Date);
        expect(result.finishDate).toBeInstanceOf(Date);
        expect(result.raceTypeList).toContain('jra');
    });
});

describe('parseRaceSearchParams', () => {
    it('[T-10] parseRaceSearchParams_有効なplaceIdList_パースする', () => {
        // Arrange
        const params = new URLSearchParams({ placeIdList: 'place1,place2' });

        // Act
        const result = parseRaceSearchParams(params);

        // Assert
        expect(result.placeIdList).toEqual(['place1', 'place2']);
        expect(result.placeHeldDaysMap).toBeUndefined();
    });

    it('[T-11] parseRaceSearchParams_placeIdList未指定_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({});

        // Act & Assert
        expect(() => parseRaceSearchParams(params)).toThrow(ValidationError);
    });

    it('[T-12] parseRaceSearchParams_placeIdListが空文字_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({ placeIdList: '' });

        // Act & Assert
        expect(() => parseRaceSearchParams(params)).toThrow(ValidationError);
    });

    it('[T-13] parseRaceSearchParams_placeIdListがカンマのみで有効値なし_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({ placeIdList: ',' });

        // Act & Assert
        expect(() => parseRaceSearchParams(params)).toThrow(
            'placeIdListに有効な値がありません',
        );
    });

    it('[T-14] parseRaceSearchParams_placeHeldDaysMapが有効なJSON_パースする', () => {
        // Arrange
        const map = { place1: { heldTimes: 1, heldDayTimes: 2 } };
        const params = new URLSearchParams({
            placeIdList: 'place1',
            placeHeldDaysMap: JSON.stringify(map),
        });

        // Act
        const result = parseRaceSearchParams(params);

        // Assert
        expect(result.placeHeldDaysMap).toEqual(map);
    });

    it('[T-15] parseRaceSearchParams_placeHeldDaysMapが無効なJSON_undefinedを返す', () => {
        // Arrange
        const params = new URLSearchParams({
            placeIdList: 'place1',
            placeHeldDaysMap: 'not-valid-json',
        });

        // Act
        const result = parseRaceSearchParams(params);

        // Assert
        expect(result.placeIdList).toEqual(['place1']);
        expect(result.placeHeldDaysMap).toBeUndefined();
    });
});

describe('parseCommonSearchParams (VAL-01: YYYY-MM-DD形式のInvalid Dateガード)', () => {
    it('[T-16] parseCommonSearchParams_YYYYMMDD形式だが無効な月日_ValidationErrorを投げる', () => {
        // Arrange
        const params = new URLSearchParams({
            startDate: '2026-13-99',
            finishDate: '2025-01-31',
            raceTypeList: 'jra',
        });

        // Act & Assert
        expect(() => parseCommonSearchParams(params)).toThrow(ValidationError);
    });
});
