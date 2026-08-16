/**
 * domain/service/gradeInference/extractAutoraceGrade テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | text        | 期待結果 |
 * |------|-------------|----------|
 * | T-01 | 'ＳＧ優勝戦'| 'SG'     |
 * | T-02 | 'Ｇ１優勝戦'| 'GⅠ'     |
 * | T-03 | 'Ｇ２優勝戦'| 'GⅡ'     |
 * | T-04 | '一般戦'    | '開催'（フォールバック）|
 */

import { describe, expect, it } from 'bun:test';

import { extractAutoraceGradeFromText } from '../../../../../src/domain/service/gradeInference/extractAutoraceGrade';

describe('extractAutoraceGradeFromText', () => {
    it('T-01_SGパターンに一致_SGを返す', () => {
        // Arrange & Act
        const result = extractAutoraceGradeFromText('ＳＧ優勝戦');

        // Assert
        expect(result).toBe('SG');
    });

    it('T-02_GⅠパターンに一致_GⅠを返す', () => {
        // Arrange & Act
        const result = extractAutoraceGradeFromText('Ｇ１優勝戦');

        // Assert
        expect(result).toBe('GⅠ');
    });

    it('T-03_GⅡパターンに一致_GⅡを返す', () => {
        // Arrange & Act
        const result = extractAutoraceGradeFromText('Ｇ２優勝戦');

        // Assert
        expect(result).toBe('GⅡ');
    });

    it('T-04_いずれのパターンにも一致しない_開催を返す', () => {
        // Arrange & Act
        const result = extractAutoraceGradeFromText('一般戦');

        // Assert
        expect(result).toBe('開催');
    });
});
