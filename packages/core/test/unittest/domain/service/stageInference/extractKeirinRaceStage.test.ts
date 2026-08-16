/**
 * domain/service/stageInference/extractKeirinRaceStage テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | text                     | 期待結果               |
 * |------|--------------------------|-------------------------|
 * | T-01 | '第1R 10:00 Ｓ級ＧＰ'    | 'S級グランプリ'（トークン一致）|
 * | T-02 | '第1R 10:00 未知ステージ'| null（一致なし）        |
 * | T-03 | '第1R 10:00 Ｓ級ＧＰ'（list省略・実マスタStageAliasList使用） | 'S級グランプリ' |
 * | T-04 | '第1R 10:00 未知ステージ'（list省略・実マスタStageAliasList使用） | null |
 * | T-05 | 'ガールズ Ｓ級ＧＰ'（複数エントリのトークンが同時に一致） | 'ガールズケイリン'（listの並び順ではなく、テキスト中で先に出現したトークン優先）|
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '../../../../../src/domain/model/valueObject/raceType';
import { extractKeirinRaceStage } from '../../../../../src/domain/service/stageInference/extractKeirinRaceStage';

const TEST_LIST = [
    {
        stage: 'S級グランプリ',
        stageByWebSite: ['Ｓ級ＧＰ'],
        raceType: RaceType.KEIRIN,
    },
];

describe('extractKeirinRaceStage', () => {
    it('T-01_テキスト中にstageByWebSiteのトークンを含む_一致したステージを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceStage('第1R 10:00 Ｓ級ＧＰ', TEST_LIST);

        // Assert
        expect(result).toBe('S級グランプリ');
    });

    it('T-02_テキスト中にいずれのトークンも含まない_nullを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceStage(
            '第1R 10:00 未知ステージ',
            TEST_LIST,
        );

        // Assert
        expect(result).toBeNull();
    });

    it('T-03_list省略時は実マスタ(StageAliasList)を使用_一致したステージを返す', () => {
        // Arrange & Act: list を省略し、実際のマスタデータで判定させる
        const result = extractKeirinRaceStage('第1R 10:00 Ｓ級ＧＰ');

        // Assert
        expect(result).toBe('S級グランプリ');
    });

    it('T-04_list省略時は実マスタ(StageAliasList)を使用_一致なしはnullを返す', () => {
        // Arrange & Act
        const result = extractKeirinRaceStage('第1R 10:00 未知ステージ');

        // Assert
        expect(result).toBeNull();
    });

    it('T-05_複数エントリのトークンが同時に一致_テキスト中で先に出現したトークンのステージを返す', () => {
        // Arrange: 'ガールズ'（テキスト前方）と'Ｓ級ＧＰ'（テキスト後方かつlist先頭エントリ）の
        // 両トークンがstageMapに存在する
        const multiMatchList = [
            {
                stage: 'S級グランプリ',
                stageByWebSite: ['Ｓ級ＧＰ'],
                raceType: RaceType.KEIRIN,
            },
            {
                stage: 'ガールズケイリン',
                stageByWebSite: ['ガールズ'],
                raceType: RaceType.KEIRIN,
            },
        ];

        // Act
        const result = extractKeirinRaceStage(
            'ガールズ Ｓ級ＧＰ',
            multiMatchList,
        );

        // Assert: listではpriority10の'S級グランプリ'が先頭だが、
        // トークン照合はテキストのトークン順で行われるため、先に出現する'ガールズ'が勝つ
        expect(result).toBe('ガールズケイリン');
    });
});
