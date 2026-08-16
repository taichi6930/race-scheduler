/**
 * domain/policy/fetchCadence テスト
 *
 * @spec SPEC-SCRAPE-001
 *
 * ## デシジョンテーブル: isYearlyFetchRaceType
 *
 * | #    | raceType | 期待結果 |
 * |------|----------|----------|
 * | T-01 | JRA      | true     |
 * | T-02 | BOATRACE | true     |
 * | T-03 | NAR      | false    |
 * | T-04 | KEIRIN   | false    |
 *
 * ## デシジョンテーブル: buildFetchDateList
 *
 * | #    | raceType | startDate  | finishDate | 期待結果                        |
 * |------|----------|------------|------------|----------------------------------|
 * | T-05 | JRA      | 2024-03-15 | 2026-01-10 | [2024-01-01, 2025-01-01, 2026-01-01]（年単位）|
 * | T-06 | BOATRACE | 2025-06-01 | 2025-06-30 | [2025-01-01]（同一年は1件）      |
 * | T-07 | NAR      | 2025-01-15 | 2025-03-10 | [2025-01-01, 2025-02-01, 2025-03-01]（月単位）|
 * | T-08 | KEIRIN   | 2025-01-01 | 2025-01-01 | [2025-01-01]（同一月は1件）      |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '../../../../src/domain/model/valueObject/raceType';
import {
    buildFetchDateList,
    isYearlyFetchRaceType,
} from '../../../../src/domain/policy/fetchCadence';

describe('isYearlyFetchRaceType', () => {
    it('T-01_JRA_trueを返す', () => {
        // Arrange & Act
        const result = isYearlyFetchRaceType(RaceType.JRA);

        // Assert
        expect(result).toBe(true);
    });

    it('T-02_BOATRACE_trueを返す', () => {
        // Arrange & Act
        const result = isYearlyFetchRaceType(RaceType.BOATRACE);

        // Assert
        expect(result).toBe(true);
    });

    it('T-03_NAR_falseを返す', () => {
        // Arrange & Act
        const result = isYearlyFetchRaceType(RaceType.NAR);

        // Assert
        expect(result).toBe(false);
    });

    it('T-04_KEIRIN_falseを返す', () => {
        // Arrange & Act
        const result = isYearlyFetchRaceType(RaceType.KEIRIN);

        // Assert
        expect(result).toBe(false);
    });
});

describe('buildFetchDateList', () => {
    it('T-05_JRAは年単位で各年1月1日のリストを返す', () => {
        // Arrange
        const startDate = new Date(2024, 2, 15);
        const finishDate = new Date(2026, 0, 10);

        // Act
        const result = buildFetchDateList(RaceType.JRA, startDate, finishDate);

        // Assert
        expect(result).toEqual([
            new Date(2024, 0, 1),
            new Date(2025, 0, 1),
            new Date(2026, 0, 1),
        ]);
    });

    it('T-06_BOATRACEで同一年の場合は1件のみ返す', () => {
        // Arrange
        const startDate = new Date(2025, 5, 1);
        const finishDate = new Date(2025, 5, 30);

        // Act
        const result = buildFetchDateList(
            RaceType.BOATRACE,
            startDate,
            finishDate,
        );

        // Assert
        expect(result).toEqual([new Date(2025, 0, 1)]);
    });

    it('T-07_NARは月単位で各月1日のリストを返す', () => {
        // Arrange
        const startDate = new Date(2025, 0, 15);
        const finishDate = new Date(2025, 2, 10);

        // Act
        const result = buildFetchDateList(RaceType.NAR, startDate, finishDate);

        // Assert
        expect(result).toEqual([
            new Date(2025, 0, 1),
            new Date(2025, 1, 1),
            new Date(2025, 2, 1),
        ]);
    });

    it('T-08_KEIRINで同一月の場合は1件のみ返す', () => {
        // Arrange
        const startDate = new Date(2025, 0, 1);
        const finishDate = new Date(2025, 0, 1);

        // Act
        const result = buildFetchDateList(
            RaceType.KEIRIN,
            startDate,
            finishDate,
        );

        // Assert
        expect(result).toEqual([new Date(2025, 0, 1)]);
    });
});
