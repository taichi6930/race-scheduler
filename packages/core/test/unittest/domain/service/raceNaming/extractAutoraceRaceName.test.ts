/**
 * domain/service/raceNaming/extractAutoraceRaceName テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | raceSummaryInfoChild        | locationName | grade | 期待結果                     |
 * |------|------------------------------|--------------|-------|-------------------------------|
 * | T-01 | 日本選手権オートレース       | 川口         | SG    | 日本選手権オートレース        |
 * | T-02 | 日本選手権オートレース       | 川口         | GⅠ    | 川口GⅠ（keywordは一致するがgrade不一致でフォールバック）|
 * | T-03 | スーパースター王座決定戦     | 山陽         | SG    | スーパースター王座決定戦      |
 * | T-04 | 全日本選抜オートレース       | 川口         | SG    | 全日本選抜オートレース        |
 * | T-05 | オートレースグランプリ       | 川口         | SG    | オートレースグランプリ        |
 * | T-06 | オールスター・オートレース   | 川口         | SG    | オールスター・オートレース    |
 * | T-07 | 共同通信社杯プレミアムカップ | 伊勢崎       | GⅠ    | 共同通信社杯プレミアムカップ  |
 * | T-08 | 通常開催                     | 浜松         | GⅠ    | 浜松GⅠ（いずれのkeywordにも不一致でフォールバック）|
 */

import { describe, expect, it } from 'bun:test';

import { extractAutoraceRaceName } from '../../../../../src/domain/service/raceNaming/extractAutoraceRaceName';

describe('extractAutoraceRaceName', () => {
    it('T-01_日本選手権かつSG_日本選手権オートレースを返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceName(
            '日本選手権オートレース',
            '川口',
            'SG',
        );

        // Assert
        expect(result).toBe('日本選手権オートレース');
    });

    it('T-02_日本選手権かつ非SG_フォールバック名を返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceName(
            '日本選手権オートレース',
            '川口',
            'GⅠ',
        );

        // Assert
        expect(result).toBe('川口GⅠ');
    });

    it('T-03_スーパースターかつSG_スーパースター王座決定戦を返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceName(
            'スーパースター王座決定戦',
            '山陽',
            'SG',
        );

        // Assert
        expect(result).toBe('スーパースター王座決定戦');
    });

    it('T-04_全日本選抜かつSG_全日本選抜オートレースを返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceName(
            '全日本選抜オートレース',
            '川口',
            'SG',
        );

        // Assert
        expect(result).toBe('全日本選抜オートレース');
    });

    it('T-05_オートレースグランプリかつSG_オートレースグランプリを返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceName(
            'オートレースグランプリ',
            '川口',
            'SG',
        );

        // Assert
        expect(result).toBe('オートレースグランプリ');
    });

    it('T-06_オールスターかつSG_オールスターオートレースを返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceName(
            'オールスター・オートレース',
            '川口',
            'SG',
        );

        // Assert
        expect(result).toBe('オールスター・オートレース');
    });

    it('T-07_共同通信かつGⅠ_共同通信社杯プレミアムカップを返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceName(
            '共同通信社杯プレミアムカップ',
            '伊勢崎',
            'GⅠ',
        );

        // Assert
        expect(result).toBe('共同通信社杯プレミアムカップ');
    });

    it('T-08_いずれのkeywordにも不一致_locationNameとgradeの結合を返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceName('通常開催', '浜松', 'GⅠ');

        // Assert
        expect(result).toBe('浜松GⅠ');
    });
});
