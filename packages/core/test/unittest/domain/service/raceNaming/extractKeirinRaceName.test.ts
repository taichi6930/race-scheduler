/**
 * domain/service/raceNaming/extractKeirinRaceName テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | seriesRaceName             | raceStage      | 期待結果             |
 * |------|-----------------------------|----------------|----------------------|
 * | T-01 | 競輪祭                      | L級ガールズ決勝     | 競輪祭女子王座戦     |
 * | T-02 | 競輪祭                      | Ｓ級決勝       | 競輪祭（フォールバック。stage不一致でif1がfalse）|
 * | T-03 | 高松宮記念杯                | L級ガールズ決勝     | パールカップ         |
 * | T-04 | オールスター競輪            | L級ガールズ決勝     | 女子オールスター競輪 |
 * | T-05 | サマーナイトフェスティバル  | L級ガールズ決勝     | ガールズケイリンフェスティバル |
 * | T-06 | KEIRINグランプリ            | Ｓ級決勝       | 寺内大吉記念杯競輪   |
 * | T-07 | KEIRINグランプリ            | グランプリ決勝 | KEIRINグランプリ（フォールバック。stage一致でif5がfalse）|
 * | T-08 | 小田原FⅡ                   | Ｓ級決勝       | 小田原FⅡ（フォールバック。全条件のseriesRaceName不一致）|
 */

import { describe, expect, it } from 'bun:test';
import type { RaceStage } from '../../../../../src/domain/model/valueObject/raceStage';
import { extractKeirinRaceName } from '../../../../../src/domain/service/raceNaming/extractKeirinRaceName';

describe('extractKeirinRaceName', () => {
    it('T-01_競輪祭かつガールズステージ_競輪祭女子王座戦を返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceName(
            '競輪祭',
            'L級ガールズ決勝' as RaceStage,
        );

        // Assert
        expect(result).toBe('競輪祭女子王座戦');
    });

    it('T-02_競輪祭かつ非ガールズステージ_seriesRaceNameをそのまま返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceName('競輪祭', 'Ｓ級決勝' as RaceStage);

        // Assert
        expect(result).toBe('競輪祭');
    });

    it('T-03_高松宮記念杯かつガールズステージ_パールカップを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceName(
            '高松宮記念杯',
            'L級ガールズ決勝' as RaceStage,
        );

        // Assert
        expect(result).toBe('パールカップ');
    });

    it('T-04_オールスター競輪かつガールズステージ_女子オールスター競輪を返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceName(
            'オールスター競輪',
            'L級ガールズ決勝' as RaceStage,
        );

        // Assert
        expect(result).toBe('女子オールスター競輪');
    });

    it('T-05_サマーナイトフェスティバルかつガールズステージ_ガールズケイリンフェスティバルを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceName(
            'サマーナイトフェスティバル',
            'L級ガールズ決勝' as RaceStage,
        );

        // Assert
        expect(result).toBe('ガールズケイリンフェスティバル');
    });

    it('T-06_KEIRINグランプリかつ非グランプリステージ_寺内大吉記念杯競輪を返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceName(
            'KEIRINグランプリ',
            'Ｓ級決勝' as RaceStage,
        );

        // Assert
        expect(result).toBe('寺内大吉記念杯競輪');
    });

    it('T-07_KEIRINグランプリかつグランプリステージ_seriesRaceNameをそのまま返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceName(
            'KEIRINグランプリ',
            'グランプリ決勝' as RaceStage,
        );

        // Assert
        expect(result).toBe('KEIRINグランプリ');
    });

    it('T-08_いずれの特殊ケースにも一致しない場合_seriesRaceNameをそのまま返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceName(
            '小田原FⅡ',
            'Ｓ級決勝' as RaceStage,
        );

        // Assert
        expect(result).toBe('小田原FⅡ');
    });
});
