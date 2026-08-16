/**
 * raceTypeConstants.test.ts - RACE_TYPE_VALUES のユニットテスト
 *
 * ## デシジョンテーブル（RACE_TYPE_VALUES）
 *
 * 対象は分岐（if/三項/&&/??/switch/catch/early return/default引数）を含まない
 * `Object.values(RaceType)` の単純な再エクスポートであるため、分岐網羅ではなく
 * 「RaceType を単一の出所として値・順序をそのまま維持しているか」を検証する。
 *
 * | #    | 検証観点                                              | 期待結果                                   |
 * |------|--------------------------------------------------------|---------------------------------------------|
 * | T-01 | RACE_TYPE_VALUES の要素                                 | RaceType の全値と過不足なく一致する         |
 * | T-02 | RACE_TYPE_VALUES の順序                                 | jra, nar, keirin, overseas, autorace, boatrace の定義順を維持する |
 * | T-03 | RACE_TYPE_VALUES と Object.values(RaceType) の関係       | 同一の値配列である（RaceType を単一の出所とする） |
 */
import 'reflect-metadata';

import { describe, expect, it } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { RACE_TYPE_VALUES } from '../../../src/utility/raceTypeConstants';

describe('RACE_TYPE_VALUES', () => {
    it('[T-01] RACE_TYPE_VALUES_RaceTypeの全値_過不足なく一致すること', () => {
        // Arrange
        const expected = Object.values(RaceType);

        // Act
        const actual = RACE_TYPE_VALUES;

        // Assert
        expect([...actual].sort()).toEqual([...expected].sort());
    });

    it('[T-02] RACE_TYPE_VALUES_定義順_jraからboatraceまでの順序を維持すること', () => {
        // Arrange
        const expectedOrder: RaceType[] = [
            RaceType.JRA,
            RaceType.NAR,
            RaceType.KEIRIN,
            RaceType.OVERSEAS,
            RaceType.AUTORACE,
            RaceType.BOATRACE,
        ];

        // Act
        const actual = RACE_TYPE_VALUES;

        // Assert
        expect(actual).toEqual(expectedOrder);
    });

    it('[T-03] RACE_TYPE_VALUES_ObjectValuesRaceTypeとの関係_同一の値配列であること', () => {
        // Arrange
        const expected = Object.values(RaceType);

        // Act
        const actual = RACE_TYPE_VALUES;

        // Assert
        expect(actual).toEqual(expected);
    });
});
