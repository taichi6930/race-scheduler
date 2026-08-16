/**
 * processOverseasRaceName ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | processOverseasRaceName | 全角文字 | 半角に変換 | Line |
 * | 2  | processOverseasRaceName | ステークス | S に変換 | Line |
 * | 3  | processOverseasRaceName | カップ | C に変換 | Line |
 * | 4  | processOverseasRaceName | サラ系 | 削除 | Line |
 * | 5  | processOverseasRaceName | （L） | 全角括弧が半角化された後、半角(L)ルールで削除 | Line |
 * | 6  | processOverseasRaceName | (L) | 削除 | Line |
 * | 7  | processOverseasRaceName | () | 削除 | Line |
 * | 8  | processOverseasRaceName | ブリーダーズC | BC に変換 | Line |
 * | 9  | processOverseasRaceName | ハンデキャップ | H に変換 | Line |
 *
 * 注記（Q2-2）: `OVERSEAS_RACE_RULES` の `（L）`（全角括弧）ルールは、
 * `processOverseasRaceName` 内で先に実行される `replaceFromCodePoint` の正規化が
 * 全角括弧（（）をすべて半角括弧に変換するため、実行時にはこのルールへ到達し得ない
 * （デッドコード）。本ファイルの「（L）」関連テストは、実際には半角 `\(L\)` ルールが
 * 適用された結果を検証している旨をテスト名・コメントで明記する。
 */

import { describe, expect, it } from 'bun:test';
import { processOverseasRaceName } from '@race-schedule/core';

describe('processOverseasRaceName', () => {
    describe('全角文字の半角変換', () => {
        it('全角数字を半角に変換', () => {
            const result = processOverseasRaceName({
                name: 'ダービー１０',
            });

            expect(result).toBe('ダービー10');
        });

        it('全角英字を半角に変換', () => {
            const result = processOverseasRaceName({
                name: 'ダービーＡＢＣ',
            });

            expect(result).toBe('ダービーABC');
        });

        it('全角小文字を半角に変換', () => {
            const result = processOverseasRaceName({
                name: 'ダービーａｂｃ',
            });

            expect(result).toBe('ダービーabc');
        });

        it('全角記号を半角に変換', () => {
            const result = processOverseasRaceName({
                name: 'ダービー：テスト＝サンプル',
            });

            expect(result).toBe('ダービー:テスト=サンプル');
        });
    });

    describe('レース名ルール適用', () => {
        it('ステークスをSに変換', () => {
            const result = processOverseasRaceName({
                name: 'ダービーステークス',
            });

            expect(result).toBe('ダービーS');
        });

        it('カップをCに変換', () => {
            const result = processOverseasRaceName({
                name: 'ゴールドカップ',
            });

            expect(result).toBe('ゴールドC');
        });

        it('サラ系を削除', () => {
            const result = processOverseasRaceName({
                name: 'テストサラ系レース',
            });

            expect(result).toBe('テストレース');
        });

        it('（L）は半角化後に半角(L)ルールで削除される（全角括弧ルール自体は到達不能）', () => {
            const result = processOverseasRaceName({
                name: 'テスト（L）レース',
            });

            expect(result).toBe('テストレース');
        });

        it('(L)を削除（半角括弧）', () => {
            const result = processOverseasRaceName({
                name: 'テスト(L)レース',
            });

            expect(result).toBe('テストレース');
        });

        it('()を削除（空の括弧）', () => {
            const result = processOverseasRaceName({
                name: 'テスト()レース',
            });

            expect(result).toBe('テストレース');
        });

        it('ブリーダーズCをBCに変換', () => {
            const result = processOverseasRaceName({
                name: 'ブリーダーズCダービー',
            });

            expect(result).toBe('BCダービー');
        });

        it('ハンデキャップをHに変換', () => {
            const result = processOverseasRaceName({
                name: 'テストハンデキャップ',
            });

            expect(result).toBe('テストH');
        });
    });

    describe('複合ルール適用', () => {
        it('複数のルールが同時に適用される - ステークス + ハンデキャップ', () => {
            const result = processOverseasRaceName({
                name: 'ダービーステークスハンデキャップ',
            });

            expect(result).toBe('ダービーSH');
        });

        it('複数のルールが同時に適用される - カップ + サラ系', () => {
            const result = processOverseasRaceName({
                name: 'ゴールドカップサラ系',
            });

            expect(result).toBe('ゴールドC');
        });

        it('複数の括弧と記号を削除 - 最初の1つのみが適用される', () => {
            const result = processOverseasRaceName({
                name: 'テスト（L）レース(L)サンプル()',
            });

            // 全角（L）は半角化されて先頭の(L)として扱われ、\(L\)ルールで削除される。
            // 残る半角(L)・()のうち、\(\)ルールは最初の1つのみ削除する。
            expect(result).toBe('テストレース(L)サンプル');
        });

        it('全角 + ルール適用 - 全角数字 + ステークス', () => {
            const result = processOverseasRaceName({
                name: 'ダービーステークス１０',
            });

            expect(result).toBe('ダービーS10');
        });

        it('全角 + ルール適用 - 全角英字 + ブリーダーズC', () => {
            const result = processOverseasRaceName({
                name: 'ダービーＳブリーダーズC',
            });

            expect(result).toBe('ダービーSBC');
        });
    });

    describe('エッジケース', () => {
        it('空の入力 → 空文字を返す', () => {
            const result = processOverseasRaceName({
                name: '',
            });

            expect(result).toBe('');
        });

        it('ルールに該当しないテキスト → そのまま返す', () => {
            const result = processOverseasRaceName({
                name: 'テストレース',
            });

            expect(result).toBe('テストレース');
        });

        it('同じルールは最初の1つのみ適用される', () => {
            const result = processOverseasRaceName({
                name: 'ステークスステークス',
            });

            // replace()は最初の1つのみ置換するため、Sステークスになる
            expect(result).toBe('Sステークス');
        });

        it('レース名の最初の全角記号', () => {
            const result = processOverseasRaceName({
                name: '（テスト）レース',
            });

            expect(result).toBe('(テスト)レース');
        });

        it('全角(L)と半角(L)はどちらも半角化後に同じ半角(L)ルールで削除される', () => {
            const fullWidthResult = processOverseasRaceName({
                name: 'テスト（L）サンプル',
            });

            const halfWidthResult = processOverseasRaceName({
                name: 'テスト(L)サンプル',
            });

            expect(fullWidthResult).toBe('テストサンプル');
            expect(halfWidthResult).toBe('テストサンプル');
        });

        it('ルール適用の順序に依存しない結果', () => {
            const result = processOverseasRaceName({
                name: 'ダービーステークスハンデキャップ（L）',
            });

            expect(result).toBe('ダービーSH');
        });

        it('複数の空き括弧は最初の1つのみ削除', () => {
            const result = processOverseasRaceName({
                name: 'テスト()()()レース',
            });

            // replace()は最初の1つのみ削除するため、最初の()のみ削除される
            expect(result).toBe('テスト()()レース');
        });
    });

    describe('置換ルール - 詳細パターン', () => {
        it('全角コロン : を : に変換', () => {
            const result = processOverseasRaceName({
                name: 'テスト：レース',
            });

            expect(result).toBe('テスト:レース');
        });

        it('全角等号 = を = に変換', () => {
            const result = processOverseasRaceName({
                name: 'テスト＝レース',
            });

            expect(result).toBe('テスト=レース');
        });

        it('全角アンダースコア _ を _ に変換', () => {
            const result = processOverseasRaceName({
                name: 'テスト＿レース',
            });

            expect(result).toBe('テスト_レース');
        });

        it('replaceFromCodePointで対応している括弧のみが変換される', () => {
            const result = processOverseasRaceName({
                name: '（サンプル）[スポンサー]{イベント}',
            });

            // （）は半角括弧に変換されて(サンプル)になる。［］{}はそのまま半角のため変化しない。
            expect(result).toBe('(サンプル)[スポンサー]{イベント}');
        });
    });
});
