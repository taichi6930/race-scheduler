/**
 * schemas/raceValidation テスト
 *
 * ## デシジョンテーブル: raceTypeArraySchema
 *
 * | #    | Input                              | 期待結果                | Coverage         |
 * |------|-------------------------------------|--------------------------|-------------------|
 * | T-01 | [RaceType.JRA, RaceType.NAR]        | 正常パース               | 正常系・複数要素  |
 * | T-02 | [RaceType.KEIRIN]                   | 正常パース               | 正常系・1要素     |
 * | T-03 | []                                  | ZodError（min(1)違反）   | 異常系・空配列    |
 * | T-04 | ['invalid']                         | ZodError（無効な種別）   | 異常系・無効値    |
 * | T-05 | 'jra'（非配列）                     | ZodError（型不一致）     | 異常系・非配列    |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '../../../src/domain/model/valueObject/raceType';
import { raceTypeArraySchema } from '../../../src/schemas/raceValidation';

describe('raceTypeArraySchema', () => {
    it('[T-01] raceTypeArraySchema_複数の有効なRaceType_正常にパースされる', () => {
        // Arrange
        const input = [RaceType.JRA, RaceType.NAR];

        // Act
        const result = raceTypeArraySchema.parse(input);

        // Assert
        expect(result).toEqual(input);
    });

    it('[T-02] raceTypeArraySchema_1件の有効なRaceType_正常にパースされる', () => {
        // Arrange
        const input = [RaceType.KEIRIN];

        // Act
        const result = raceTypeArraySchema.parse(input);

        // Assert
        expect(result).toEqual(input);
    });

    it('[T-03] raceTypeArraySchema_空配列_min(1)違反でエラーをthrow', () => {
        // Arrange & Act & Assert
        expect(() => raceTypeArraySchema.parse([])).toThrow();
    });

    it('[T-04] raceTypeArraySchema_無効なRaceType文字列_エラーをthrow', () => {
        // Arrange & Act & Assert
        expect(() => raceTypeArraySchema.parse(['invalid'])).toThrow();
    });

    it('[T-05] raceTypeArraySchema_非配列入力_エラーをthrow', () => {
        // Arrange & Act & Assert
        expect(() => raceTypeArraySchema.parse('jra')).toThrow();
    });
});
