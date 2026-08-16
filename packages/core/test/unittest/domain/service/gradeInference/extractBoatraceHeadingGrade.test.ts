/**
 * domain/service/gradeInference/extractBoatraceHeadingGrade テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | headingClass                | 期待結果   |
 * |------|------------------------------|------------|
 * | T-01 | 'heading2_title is-SGa'      | 'SG'       |
 * | T-02 | 'heading2_title is-PGa'      | 'PGⅠ'      |
 * | T-03 | 'heading2_title is-G1a'      | undefined  |
 */

import { describe, expect, it } from 'bun:test';

import { extractBoatraceHeadingGrade } from '../../../../../src/domain/service/gradeInference/extractBoatraceHeadingGrade';

describe('extractBoatraceHeadingGrade', () => {
    it('T-01_is-SGaクラスを含む_SGを返す', () => {
        // Arrange & Act
        const result = extractBoatraceHeadingGrade('heading2_title is-SGa');

        // Assert
        expect(result).toBe('SG');
    });

    it('T-02_is-PGaクラスを含む_PGⅠを返す', () => {
        // Arrange & Act
        const result = extractBoatraceHeadingGrade('heading2_title is-PGa');

        // Assert
        expect(result).toBe('PGⅠ');
    });

    it('T-03_いずれのクラスも含まない_undefinedを返す', () => {
        // Arrange & Act
        const result = extractBoatraceHeadingGrade('heading2_title is-G1a');

        // Assert
        expect(result).toBeUndefined();
    });
});
