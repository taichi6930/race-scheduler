/**
 * domain/service/gradeInference/extractKeirinGrade テスト
 *
 * ## デシジョンテーブル: extractKeirinGradeFromText
 *
 * | #    | text        | 期待結果  |
 * |------|-------------|-----------|
 * | T-01 | 'ＧＰ優勝戦'| 'GP'      |
 * | T-02 | '一般戦'    | undefined |
 * | T-09 | 'ＳＧ優勝戦'| undefined（KEIRINにSGは存在しない）|
 * | T-10 | 'F1・G1同時開催'（複数パターンが同時に一致） | 'FⅠ'（KEIRIN_GRADE_PATTERNSはFⅠがGⅠより先頭のため優先）|
 *
 * ## デシジョンテーブル: extractKeirinRaceGrade
 *
 * | #    | raceName                     | baseGrade | raceStage              | year | 期待結果 |
 * |------|-------------------------------|-----------|-------------------------|------|----------|
 * | T-03 | 通常のレース名               | GⅠ        | SA混合ヤンググランプリ | 2025 | GⅡ       |
 * | T-04 | 女子オールスター競輪         | FⅡ        | Ｌ級ガ決勝              | 2025 | GⅠ       |
 * | T-05 | 女子オールスター競輪         | FⅡ        | Ｌ級ガ決勝              | 2024 | FⅡ       |
 * | T-06 | ガールズケイリンフェスティバル| GⅠ       | Ｌ級ガ決勝              | 2025 | FⅡ       |
 * | T-07 | 寺内大吉記念杯競輪           | GⅠ        | Ｓ級決勝                | 2025 | FⅠ       |
 * | T-08 | 通常のレース名               | GⅠ        | Ｓ級決勝                | 2025 | GⅠ（baseGradeそのまま）|
 */

import { describe, expect, it } from 'bun:test';
import type { RaceStage } from '../../../../../src/domain/model/valueObject/raceStage';
import {
    extractKeirinGradeFromText,
    extractKeirinRaceGrade,
} from '../../../../../src/domain/service/gradeInference/extractKeirinGrade';

describe('extractKeirinGradeFromText', () => {
    it('T-01_GPパターンに一致_GPを返す', () => {
        // Arrange & Act
        const result = extractKeirinGradeFromText('ＧＰ優勝戦');

        // Assert
        expect(result).toBe('GP');
    });

    it('T-02_いずれのパターンにも一致しない_undefinedを返す', () => {
        // Arrange & Act
        const result = extractKeirinGradeFromText('一般戦');

        // Assert
        expect(result).toBeUndefined();
    });

    it('T-09_SGパターン（KEIRINには存在しないグレード）_undefinedを返す', () => {
        // Arrange & Act
        const result = extractKeirinGradeFromText('ＳＧ優勝戦');

        // Assert
        expect(result).toBeUndefined();
    });

    it('T-10_F1とG1の両方のパターンが同時に一致_先頭パターンのFⅠを返す', () => {
        // Arrange & Act: KEIRIN_GRADE_PATTERNSはFⅠがGⅠより先に判定されるため、
        // F1/G1を両方含むテキストではFⅠが優先される
        const result = extractKeirinGradeFromText('F1・G1同時開催');

        // Assert
        expect(result).toBe('FⅠ');
    });
});

describe('extractKeirinRaceGrade', () => {
    it('T-03_SA混合ヤンググランプリステージ_GⅡを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceGrade(
            '通常のレース名',
            'GⅠ',
            'SA混合ヤンググランプリ' as RaceStage,
            new Date('2025-06-01'),
        );

        // Assert
        expect(result).toBe('GⅡ');
    });

    it('T-04_女子オールスター競輪かつ2025年以降_GⅠを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceGrade(
            '女子オールスター競輪',
            'FⅡ',
            'L級ガールズ決勝' as RaceStage,
            new Date('2025-06-01'),
        );

        // Assert
        expect(result).toBe('GⅠ');
    });

    it('T-05_女子オールスター競輪かつ2024年以前_FⅡを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceGrade(
            '女子オールスター競輪',
            'FⅡ',
            'L級ガールズ決勝' as RaceStage,
            new Date('2024-06-01'),
        );

        // Assert
        expect(result).toBe('FⅡ');
    });

    it('T-06_ガールズケイリンフェスティバル_FⅡを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceGrade(
            'ガールズケイリンフェスティバル',
            'GⅠ',
            'L級ガールズ決勝' as RaceStage,
            new Date('2025-06-01'),
        );

        // Assert
        expect(result).toBe('FⅡ');
    });

    it('T-07_寺内大吉記念杯競輪_FⅠを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceGrade(
            '寺内大吉記念杯競輪',
            'GⅠ',
            'S級決勝' as RaceStage,
            new Date('2025-06-01'),
        );

        // Assert
        expect(result).toBe('FⅠ');
    });

    it('T-08_いずれの特殊ケースにも一致しない_baseGradeをそのまま返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceGrade(
            '通常のレース名',
            'GⅠ',
            'S級決勝' as RaceStage,
            new Date('2025-06-01'),
        );

        // Assert
        expect(result).toBe('GⅠ');
    });
});
