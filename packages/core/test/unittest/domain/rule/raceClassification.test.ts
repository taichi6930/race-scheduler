/**
 * constants/raceTypeGroups テスト
 *
 * @spec SPEC-RACE-001
 *
 * ## デシジョンテーブル
 *
 * ### isMechanicalRace
 * | # | Input    | 期待結果 | Coverage       |
 * |----|----------|----------|----------------|
 * | 1  | KEIRIN   | true     | 正常系・機械式 |
 * | 2  | AUTORACE | true     | 正常系・機械式 |
 * | 3  | BOATRACE | true     | 正常系・機械式 |
 * | 4  | JRA      | false    | 異常系・競馬   |
 * | 5  | NAR      | false    | 異常系・競馬   |
 * | 6  | OVERSEAS | false    | 異常系・競馬   |
 *
 * ### isHorseRace
 * | # | Input    | 期待結果 | Coverage       |
 * |----|----------|----------|----------------|
 * | 7  | JRA      | true     | 正常系・競馬   |
 * | 8  | NAR      | true     | 正常系・競馬   |
 * | 9  | OVERSEAS | true     | 正常系・競馬   |
 * | 10 | KEIRIN   | false    | 異常系・機械式 |
 * | 11 | AUTORACE | false    | 異常系・機械式 |
 * | 12 | BOATRACE | false    | 異常系・機械式 |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '../../../../src/domain/model/valueObject/raceType';
import {
    isHorseRace,
    isMechanicalRace,
} from '../../../../src/domain/rule/raceClassification';

describe('isMechanicalRace', () => {
    describe('正常系: 機械式レース', () => {
        it('KEIRIN_機械式レース_trueを返す', () => {
            // Arrange & Act
            const result = isMechanicalRace(RaceType.KEIRIN);

            // Assert
            expect(result).toBe(true);
        });

        it('AUTORACE_機械式レース_trueを返す', () => {
            // Arrange & Act
            const result = isMechanicalRace(RaceType.AUTORACE);

            // Assert
            expect(result).toBe(true);
        });

        it('BOATRACE_機械式レース_trueを返す', () => {
            // Arrange & Act
            const result = isMechanicalRace(RaceType.BOATRACE);

            // Assert
            expect(result).toBe(true);
        });
    });

    describe('異常系: 競馬系レース', () => {
        it('JRA_競馬_falseを返す', () => {
            // Arrange & Act
            const result = isMechanicalRace(RaceType.JRA);

            // Assert
            expect(result).toBe(false);
        });

        it('NAR_地方競馬_falseを返す', () => {
            // Arrange & Act
            const result = isMechanicalRace(RaceType.NAR);

            // Assert
            expect(result).toBe(false);
        });

        it('OVERSEAS_海外競馬_falseを返す', () => {
            // Arrange & Act
            const result = isMechanicalRace(RaceType.OVERSEAS);

            // Assert
            expect(result).toBe(false);
        });
    });
});

describe('isHorseRace', () => {
    describe('正常系: 競馬系レース', () => {
        it('JRA_競馬_trueを返す', () => {
            // Arrange & Act
            const result = isHorseRace(RaceType.JRA);

            // Assert
            expect(result).toBe(true);
        });

        it('NAR_地方競馬_trueを返す', () => {
            // Arrange & Act
            const result = isHorseRace(RaceType.NAR);

            // Assert
            expect(result).toBe(true);
        });

        it('OVERSEAS_海外競馬_trueを返す', () => {
            // Arrange & Act
            const result = isHorseRace(RaceType.OVERSEAS);

            // Assert
            expect(result).toBe(true);
        });
    });

    describe('異常系: 機械式レース', () => {
        it('KEIRIN_機械式レース_falseを返す', () => {
            // Arrange & Act
            const result = isHorseRace(RaceType.KEIRIN);

            // Assert
            expect(result).toBe(false);
        });

        it('AUTORACE_機械式レース_falseを返す', () => {
            // Arrange & Act
            const result = isHorseRace(RaceType.AUTORACE);

            // Assert
            expect(result).toBe(false);
        });

        it('BOATRACE_機械式レース_falseを返す', () => {
            // Arrange & Act
            const result = isHorseRace(RaceType.BOATRACE);

            // Assert
            expect(result).toBe(false);
        });
    });
});
