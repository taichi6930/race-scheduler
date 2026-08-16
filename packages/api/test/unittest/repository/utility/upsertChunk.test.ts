/**
 * upsertChunk.test.ts - resolveUpsertChunkSize ヘルパーのユニットテスト
 *
 * ## デシジョンテーブル（resolveUpsertChunkSize）
 *
 * | #    | paramsPerRow | 期待結果（floor(100 / paramsPerRow)） |
 * |------|--------------|----------------------------------------|
 * | T-01 | 9（race）    | 11                                      |
 * | T-02 | 5（place）   | 20                                      |
 * | T-03 | 4（player）  | 25                                      |
 * | T-04 | 3（割り切れない） | 33（floorで切り捨て）              |
 */
import { describe, expect, it } from 'bun:test';

import {
    D1_MAX_BIND_VARS,
    resolveUpsertChunkSize,
} from '../../../../src/repository/utility/upsertChunk';

describe('resolveUpsertChunkSize', () => {
    it('T-01_paramsPerRowが9（race相当）_11を返すこと', () => {
        // Arrange & Act
        const result = resolveUpsertChunkSize(9);

        // Assert
        expect(result).toBe(11);
    });

    it('T-02_paramsPerRowが5（place相当）_20を返すこと', () => {
        // Arrange & Act
        const result = resolveUpsertChunkSize(5);

        // Assert
        expect(result).toBe(20);
    });

    it('T-03_paramsPerRowが4（player相当）_25を返すこと', () => {
        // Arrange & Act
        const result = resolveUpsertChunkSize(4);

        // Assert
        expect(result).toBe(25);
    });

    it('T-04_paramsPerRowが割り切れない値_floorで切り捨てること', () => {
        // Arrange & Act
        const result = resolveUpsertChunkSize(3);

        // Assert
        expect(result).toBe(33);
    });

    it('D1_MAX_BIND_VARSが100であること', () => {
        expect(D1_MAX_BIND_VARS).toBe(100);
    });
});
