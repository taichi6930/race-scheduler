/**
 * composeRacePlayerId ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | raceId                  | carNumber | 期待結果                       |
 * |---|--------------------------|-----------|--------------------------------|
 * | 1 | 'keirin202608023601'     | 7         | 'keirin20260802360107'         |
 * | 2 | 'keirin202608023601'     | 1         | 'keirin20260802360101'（0埋め）|
 * | 3 | 'keirin202608023601'     | 12        | 'keirin20260802360112'（0埋めなし）|
 * | 4 | 'jra202501050101'        | 3         | 'jra20250105010103'            |
 */

import { describe, expect, it } from 'bun:test';
import type { RaceId } from '../../../../../src/domain/model/valueObject/raceId';
import { validateRaceId } from '../../../../../src/domain/model/valueObject/raceId';
import type { RacePlayerId } from '../../../../../src/domain/model/valueObject/racePlayerId';
import { validateRacePlayerId } from '../../../../../src/domain/model/valueObject/racePlayerId';
import { composeRacePlayerId } from '../../../../../src/domain/service/identifier/composeRacePlayerId';

const asRaceId = (value: string): RaceId => validateRaceId(value);
const asRacePlayerId = (value: string): RacePlayerId =>
    validateRacePlayerId(value);

describe('composeRacePlayerId', () => {
    it('ケース#1: raceId + 車番(2桁) をそのまま連結する', () => {
        // Arrange
        const raceId = asRaceId('keirin202608023601');
        const carNumber = 7;

        // Act
        const result = composeRacePlayerId(raceId, carNumber);

        // Assert
        expect(result).toBe(asRacePlayerId('keirin20260802360107'));
    });

    it('ケース#2: 車番が1桁のとき0埋めされる', () => {
        // Arrange
        const raceId = asRaceId('keirin202608023601');
        const carNumber = 1;

        // Act
        const result = composeRacePlayerId(raceId, carNumber);

        // Assert
        expect(result).toBe(asRacePlayerId('keirin20260802360101'));
    });

    it('ケース#3: 車番が2桁のとき0埋めされない', () => {
        // Arrange
        const raceId = asRaceId('keirin202608023601');
        const carNumber = 12;

        // Act
        const result = composeRacePlayerId(raceId, carNumber);

        // Assert
        expect(result).toBe(asRacePlayerId('keirin20260802360112'));
    });

    it('ケース#4: KEIRIN以外のraceTypeでも同じ規則で合成される', () => {
        // Arrange
        const raceId = asRaceId('jra202501050101');
        const carNumber = 3;

        // Act
        const result = composeRacePlayerId(raceId, carNumber);

        // Assert
        expect(result).toBe(asRacePlayerId('jra20250105010103'));
    });
});
