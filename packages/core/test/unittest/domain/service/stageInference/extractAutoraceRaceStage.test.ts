/**
 * domain/service/stageInference/extractAutoraceRaceStage テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | raceSummaryInfoChild | 期待結果            |
 * |------|-----------------------|----------------------|
 * | T-01 | '1R 優勝戦 500m'      | '優勝戦'（パターン一致）|
 * | T-02 | '1R 予選 500m'        | null（一致なし）      |
 * | T-03 | '1R ＳＳ王座決定戦 500m'（list省略・実マスタStageAliasList使用） | 'SS王座決定戦' |
 * | T-04 | '1R 該当なしステージ 500m'（list省略・実マスタStageAliasList使用） | null |
 * | T-05 | '1R 特別優勝戦 500m'（複数エントリのパターンが同時に一致） | '優勝戦'（listの先頭エントリ優先、判定順序を厳守）|
 * | T-06 | '1R オートレースＧＰ開幕戦 500m'（list省略・実マスタStageAliasList使用、Issue #2449） | '予選' |
 * | T-07 | '1R ＭＡＸ鈴木ＯＰ枠番抽選 500m'（list省略・実マスタStageAliasList使用、Issue #2513） | '一般戦' |
 * | T-08 | '8R ＧＰオープン　枠番抽選 500m'（list省略・実マスタStageAliasList使用、Issue #2522） | '一般戦' |
 * | T-09 | '1R ＧＰ　飯塚バトル 500m'（list省略・実マスタStageAliasList使用、Issue #2523） | '一般戦' |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '../../../../../src/domain/model/valueObject/raceType';
import { extractAutoraceRaceStage } from '../../../../../src/domain/service/stageInference/extractAutoraceRaceStage';

const TEST_LIST = [
    {
        stage: '優勝戦',
        stageByWebSite: ['優勝戦'],
        raceType: RaceType.AUTORACE,
    },
];

describe('extractAutoraceRaceStage', () => {
    it('T-01_テキストがstageByWebSiteのパターンに一致_一致したステージを返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceStage('1R 優勝戦 500m', TEST_LIST);

        // Assert
        expect(result).toBe('優勝戦');
    });

    it('T-02_テキストがいずれのパターンにも一致しない_nullを返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceStage('1R 予選 500m', TEST_LIST);

        // Assert
        expect(result).toBeNull();
    });

    it('T-03_list省略時は実マスタ(StageAliasList)を使用_一致したステージを返す', () => {
        // Arrange & Act: list を省略し、実際のマスタデータで判定させる
        const result = extractAutoraceRaceStage('1R ＳＳ王座決定戦 500m');

        // Assert
        expect(result).toBe('SS王座決定戦');
    });

    it('T-04_list省略時は実マスタ(StageAliasList)を使用_一致なしはnullを返す', () => {
        // Arrange & Act
        const result = extractAutoraceRaceStage('1R 該当なしステージ 500m');

        // Assert
        expect(result).toBeNull();
    });

    it('T-05_複数エントリのパターンが同時に一致_listの先頭エントリのステージを返す', () => {
        // Arrange: '優勝戦' と '特別優勝戦' の両方の正規表現が'特別優勝戦'に一致する
        const multiMatchList = [
            {
                stage: '優勝戦',
                stageByWebSite: ['優勝戦'],
                raceType: RaceType.AUTORACE,
            },
            {
                stage: '特別優勝戦',
                stageByWebSite: ['特別優勝戦'],
                raceType: RaceType.AUTORACE,
            },
        ];

        // Act
        const result = extractAutoraceRaceStage(
            '1R 特別優勝戦 500m',
            multiMatchList,
        );

        // Assert: より具体的な'特別優勝戦'ではなく、listの先頭（'優勝戦'）が優先される
        expect(result).toBe('優勝戦');
    });

    it('T-06_list省略時は実マスタ(StageAliasList)を使用_オートレースＧＰ開幕戦は予選と判定する', () => {
        // Arrange & Act: list を省略し、実際のマスタデータで判定させる（Issue #2449）
        const result = extractAutoraceRaceStage(
            '1R オートレースＧＰ開幕戦 500m',
        );

        // Assert
        expect(result).toBe('予選');
    });

    it('T-07_list省略時は実マスタ(StageAliasList)を使用_ＭＡＸ鈴木ＯＰ枠番抽選は一般戦と判定する', () => {
        // Arrange & Act: list を省略し、実際のマスタデータで判定させる（Issue #2513）
        const result = extractAutoraceRaceStage(
            '1R ＭＡＸ鈴木ＯＰ枠番抽選 500m',
        );

        // Assert
        expect(result).toBe('一般戦');
    });

    it('T-08_list省略時は実マスタ(StageAliasList)を使用_ＧＰオープン　枠番抽選は一般戦と判定する', () => {
        // Arrange & Act: list を省略し、実際のマスタデータで判定させる（Issue #2522）
        const result = extractAutoraceRaceStage(
            '8R ＧＰオープン　枠番抽選 500m',
        );

        // Assert
        expect(result).toBe('一般戦');
    });

    it('T-09_list省略時は実マスタ(StageAliasList)を使用_ＧＰ　飯塚バトルは一般戦と判定する', () => {
        // Arrange & Act: list を省略し、実際のマスタデータで判定させる（Issue #2523）
        const result = extractAutoraceRaceStage('1R ＧＰ　飯塚バトル 500m');

        // Assert
        expect(result).toBe('一般戦');
    });
});
