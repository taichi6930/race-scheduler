/**
 * domain/service/gradeInference/extractGradeByPatterns テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | text        | patterns                        | fallback | 期待結果 |
 * |------|-------------|----------------------------------|----------|----------|
 * | T-01 | 'SG優勝戦'  | [[/SG/, 'SG'], [/G1/, 'GⅠ']]     | undefined| 'SG'     |
 * | T-02 | 'Ｇ１優勝戦'| [[/SG/, 'SG'], [/G1/, 'GⅠ']]     | undefined| 'GⅠ'（全角→半角正規化後にマッチ）|
 * | T-03 | '一般戦'    | [[/SG/, 'SG'], [/G1/, 'GⅠ']]     | 'なし'   | 'なし'（フォールバック）|
 * | T-04 | 'SG・G1優勝戦'（複数パターンが同時に一致） | [[/SG/, 'SG'], [/G1/, 'GⅠ']] | undefined| 'SG'（先頭パターン優先、判定順序を厳守）|
 */

import { describe, expect, it } from 'bun:test';

import { extractGradeByPatterns } from '../../../../../src/domain/service/gradeInference/extractGradeByPatterns';

describe('extractGradeByPatterns', () => {
    const patterns: readonly (readonly [RegExp, string])[] = [
        [/SG/, 'SG'],
        [/G1/, 'GⅠ'],
    ];

    it('T-01_先頭パターンに一致_一致したグレードを返す', () => {
        // Arrange & Act
        const result = extractGradeByPatterns('SG優勝戦', patterns, undefined);

        // Assert
        expect(result).toBe('SG');
    });

    it('T-02_全角テキストが正規化後にパターンへ一致_一致したグレードを返す', () => {
        // Arrange & Act
        const result = extractGradeByPatterns(
            'Ｇ１優勝戦',
            patterns,
            undefined,
        );

        // Assert
        expect(result).toBe('GⅠ');
    });

    it('T-03_いずれのパターンにも一致しない_fallbackを返す', () => {
        // Arrange & Act
        const result = extractGradeByPatterns('一般戦', patterns, 'なし');

        // Assert
        expect(result).toBe('なし');
    });

    it('T-04_複数パターンが同時に一致_先頭パターンのグレードを返す', () => {
        // Arrange & Act: 'SG' と 'G1' の両方の正規表現が一致するテキストを渡す
        const result = extractGradeByPatterns(
            'SG・G1優勝戦',
            patterns,
            undefined,
        );

        // Assert: patterns の先頭（SG）が優先され、後方のG1は評価されない
        expect(result).toBe('SG');
    });
});
