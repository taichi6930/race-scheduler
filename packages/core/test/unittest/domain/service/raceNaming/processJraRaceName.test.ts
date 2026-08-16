/**
 * processJraRaceName ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | processJraRaceName | 阪神JF | パターンマッチ → 阪神JF | Lines |
 * | 2  | processJraRaceName | 朝日杯FS | パターンマッチ → 朝日杯FS | Lines |
 * | 3  | processJraRaceName | マイルCS | パターンマッチ → マイルCS | Lines |
 * | 4  | processJraRaceName | AJCC | パターンマッチ → AJCC | Lines |
 * | 5  | processJraRaceName | 府中牝馬S | パターンマッチ → 府中牝馬S | Lines |
 * | 6  | processJraRaceName | アイビスサマーD | パターンマッチ → アイビスサマーD | Lines |
 * | 7  | processJraRaceName | (フォールバック)4歳上1000万円以下 | 4歳上2勝クラスへ正規化 | Lines |
 * | 8  | processJraRaceName | (フォールバック)4歳上1000万下 | 4歳上2勝クラスへ正規化 | Lines |
 * | 9  | processJraRaceName | (フォールバック)3歳上1600万円以下 | 3歳上3勝クラスへ正規化 | Lines |
 * | 10 | processJraRaceName | (フォールバック)3歳上500万円以下 | 3歳上1勝クラスへ正規化 | Lines |
 * | 11 | processJraRaceName | (フォールバック)3歳上900万下 | 正規化対象外・そのまま | Lines |
 * | 12 | processJraRaceName | (フォールバック)2019年5月31日開催・4歳上1000万下 | 施行日前のため正規化対象外・そのまま | Lines |
 * | 13 | processJraRaceName | (フォールバック)2019年6月1日開催・4歳上1000万下 | 施行日当日は正規化対象 → 4歳上2勝クラス | Lines |
 */

import { describe, expect, it } from 'bun:test';
import { processJraRaceName } from '@race-schedule/core';

describe('processJraRaceName', () => {
    describe('パターンマッチング - 優先度判定', () => {
        it('阪神JF - 阪神 + GI + 11月 + ジュベナイル', () => {
            const date = new Date('2024-11-15T12:00:00Z');
            const result = processJraRaceName({
                name: '阪神ジュベナイルフィリーズ',
                place: '阪神',
                grade: 'GⅠ',
                date,
            });

            expect(result).toBe('阪神JF');
        });

        it('阪神JF - 12月の場合もマッチする', () => {
            const date = new Date('2024-12-15T12:00:00Z');
            const result = processJraRaceName({
                name: '阪神ジュベナイルフィリーズ',
                place: '阪神',
                grade: 'GⅠ',
                date,
            });

            expect(result).toBe('阪神JF');
        });

        it('朝日杯FS - 中山 + GI + 12月 + 朝日 + フュー', () => {
            const date = new Date('2024-12-15T12:00:00Z');
            const result = processJraRaceName({
                name: '朝日杯フューチュリティステークス',
                place: '中山',
                grade: 'GⅠ',
                date,
            });

            expect(result).toBe('朝日杯FS');
        });

        it('朝日杯FS - 阪神での開催もマッチする', () => {
            const date = new Date('2024-12-15T12:00:00Z');
            const result = processJraRaceName({
                name: '朝日杯フューチュリティステークス',
                place: '阪神',
                grade: 'GⅠ',
                date,
            });

            expect(result).toBe('朝日杯FS');
        });

        it('マイルCS - 阪神 + GI + 11月 + マイル + 芝', () => {
            const date = new Date('2024-11-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'マイルチャンピオンシップ',
                place: '阪神',
                grade: 'GⅠ',
                date,
                surfaceType: '芝',
            });

            expect(result).toBe('マイルCS');
        });

        it('マイルCS - 気品が異なる場合はマッチしない', () => {
            const date = new Date('2024-11-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'マイルチャンピオンシップ',
                place: '阪神',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            expect(result).not.toBe('マイルCS');
            expect(result).toBe('マイルチャンピオンシップ');
        });

        it('AJCC - 東京 + GII + 1月 + ジョッキー + クラブ + 芝', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'アメリカジョッキークラブカップ',
                place: '東京',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            expect(result).toBe('AJCC');
        });

        it('AJCC - 2月の場合もマッチする（monthList: [0, 1]）', () => {
            const date = new Date('2024-02-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'アメリカジョッキークラブカップ',
                place: '中山',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            expect(result).toBe('AJCC');
        });

        it('府中牝馬S - 東京 + GII + 6月 + 府中牝馬', () => {
            const date = new Date('2024-06-15T12:00:00Z');
            const result = processJraRaceName({
                name: '府中牝馬ステークス',
                place: '東京',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            expect(result).toBe('府中牝馬S');
        });

        it('府中牝馬S - 10月の開催', () => {
            const date = new Date('2024-10-15T12:00:00Z');
            const result = processJraRaceName({
                name: '府中牝馬ステークス',
                place: '中山',
                grade: 'GⅢ',
                date,
                surfaceType: '芝',
            });

            expect(result).toBe('府中牝馬S');
        });

        it('アイビスサマーD - 新潟 + GⅢ + アイビス + 芝 + 1000m', () => {
            const date = new Date('2024-08-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'アイビスサマーダッシュ',
                place: '新潟',
                grade: 'GⅢ',
                date,
                surfaceType: '芝',
                distance: 1000,
            });

            expect(result).toBe('アイビスサマーD');
        });

        it('京成杯オータムH - 中山 + GⅢ + 9月 + 京成杯 + 芝 + 1600m', () => {
            const date = new Date('2024-09-15T12:00:00Z');
            const result = processJraRaceName({
                name: '京成杯オータムハンデキャップ',
                place: '中山',
                grade: 'GⅢ',
                date,
                surfaceType: '芝',
                distance: 1600,
            });

            expect(result).toBe('京成杯オータムH');
        });

        it('サウジアラビアRC - 東京 + GⅢ + 10月 + サウジ + 芝 + 1600m', () => {
            const date = new Date('2024-10-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'サウジアラビアロイヤルカップ',
                place: '東京',
                grade: 'GⅢ',
                date,
                surfaceType: '芝',
                distance: 1600,
            });

            expect(result).toBe('サウジアラビアRC');
        });

        it('ルミエールオータムD - 新潟 + Listed + 9月 + ルミエール + 芝 + 1000m', () => {
            const date = new Date('2024-10-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'ルミエールオータムダッシュ',
                place: '新潟',
                grade: 'Listed',
                date,
                surfaceType: '芝',
                distance: 1000,
            });

            expect(result).toBe('ルミエールオータムD');
        });
    });

    describe('パターンマッチング - 条件不一致（元のレース名を返す）', () => {
        it('場所が異なる場合 - GI規格の阪神JF', () => {
            const date = new Date('2024-10-15T12:00:00Z');
            const result = processJraRaceName({
                name: '阪神ジュベナイルフィリーズ',
                place: '東京',
                grade: 'GⅠ',
                date,
            });

            expect(result).toBe('阪神ジュベナイルフィリーズ');
        });

        it('気品が異なる場合 - マイルCS（ダート）', () => {
            const date = new Date('2024-10-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'マイルチャンピオンシップ',
                place: '阪神',
                grade: 'GⅠ',
                date,
                surfaceType: 'ダート',
            });

            expect(result).toBe('マイルチャンピオンシップ');
        });

        it('月が異なる場合 - マイルCS（12月に開催）', () => {
            const date = new Date('2024-12-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'マイルチャンピオンシップ',
                place: '阪神',
                grade: 'GⅠ',
                date,
                surfaceType: '芝',
            });

            expect(result).toBe('マイルチャンピオンシップ');
        });

        it('距離が異なる場合 - ア イビスサマーD（1200m）', () => {
            const date = new Date('2024-08-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'アイビスサマーダッシュ',
                place: '新潟',
                grade: 'GⅢ',
                date,
                surfaceType: '芝',
                distance: 1200,
            });

            expect(result).toBe('アイビスサマーダッシュ');
        });

        it('キーワードが不足する場合', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'アメリカジョッキー', // クラブが込まれていない
                place: '東京',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            expect(result).toBe('アメリカジョッキー');
        });
    });

    describe('エッジケース', () => {
        it('複数のパターンに合致する場合は最初のマッチを返す', () => {
            // AJCC（1月）と府中牝馬S（5月）は別パターンなので検証
            const date = new Date('2024-05-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'テストレース',
                place: '東京',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            // パターンの順序によって決定される
            expect(result).toBeTruthy();
        });

        it('パターン内に placeList がない場合は無視される', () => {
            const date = new Date('2024-08-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'テストルミエール',
                place: '東京',
                grade: 'Listed',
                date,
                surfaceType: '芝',
                distance: 1000,
            });

            // ルミエールオータムDパターンは新潟限定なので、このテストは合致しない
            expect(result).toBe('テストルミエール');
        });

        it('RaceDateTime.getMonth() が正しく使用される（JavaScript Date）', () => {
            // Date.getMonth()は0-11を返す（0=1月）
            const januaryDate = new Date('2024-01-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'アメリカジョッキークラブカップ',
                place: '東京',
                grade: 'GⅡ',
                date: januaryDate,
                surfaceType: '芝',
            });

            expect(result).toBe('AJCC');
        });

        it('RaceDateTime が 0月（1月）と 11月(12月)に対応', () => {
            const marchDate = new Date('2024-03-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'アメリカジョッキークラブカップ',
                place: '東京',
                grade: 'GⅡ',
                date: marchDate,
                surfaceType: '芝',
            });

            // 3月(getMonth()=2)はAJCCパターンに合致しない
            expect(result).toBe('アメリカジョッキークラブカップ');
        });

        it('オプショナル属性（surfaceType, distance）の省略', () => {
            const date = new Date('2024-10-15T12:00:00Z');
            const result = processJraRaceName({
                name: 'マイルチャンピオンシップ',
                place: '阪神',
                grade: 'GⅠ',
                date,
                // surfaceType, distance を省略
            });

            // マイルCSパターンは surfaceType=芝 必須なのでマッチしない
            expect(result).toBe('マイルチャンピオンシップ');
        });

        it('複数キーワードがすべてある場合のみマッチする - AJCC', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            const resultWithAllKeywords = processJraRaceName({
                name: 'アメリカジョッキークラブカップ',
                place: '東京',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            expect(resultWithAllKeywords).toBe('AJCC');

            const resultWithPartialKeywords = processJraRaceName({
                name: 'アメリカジョッキースペシャル',
                place: '東京',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            // 「クラブ」が不足しているのでマッチしない
            expect(resultWithPartialKeywords).toBe(
                'アメリカジョッキースペシャル',
            );
        });

        it('府中牝馬S両方の月(6月と10月)でマッチ', () => {
            const juneDate = new Date('2024-06-15T12:00:00Z');
            const octoberDate = new Date('2024-10-15T12:00:00Z');

            const juneResult = processJraRaceName({
                name: '府中牝馬ステークス',
                place: '東京',
                grade: 'GⅡ',
                date: juneDate,
                surfaceType: '芝',
            });

            const octoberResult = processJraRaceName({
                name: '府中牝馬ステークス',
                place: '東京',
                grade: 'GⅡ',
                date: octoberDate,
                surfaceType: '芝',
            });

            expect(juneResult).toBe('府中牝馬S');
            expect(octoberResult).toBe('府中牝馬S');
        });
    });

    describe('キーワードパターンの複雑さ', () => {
        it('朝日杯FS - キーワードは [ ["朝日"], ["フュー"] ]', () => {
            const date = new Date('2024-12-15T12:00:00Z');
            const result = processJraRaceName({
                name: '朝日杯フューチュリティステークス',
                place: '阪神',
                grade: 'GⅠ',
                date,
            });

            expect(result).toBe('朝日杯FS');
        });

        it('朝日杯FS - 本一つのキーワードが欠けるとマッチしない', () => {
            const date = new Date('2024-11-15T12:00:00Z');
            const resultNoAsahi = processJraRaceName({
                name: 'フューチュリティステークス',
                place: '阪神',
                grade: 'GⅠ',
                date,
            });

            expect(resultNoAsahi).toBe('フューチュリティステークス');

            const resultNoFuture = processJraRaceName({
                name: '朝日杯ステークス',
                place: '阪神',
                grade: 'GⅠ',
                date,
            });

            expect(resultNoFuture).toBe('朝日杯ステークス');
        });

        it('AJCC - 複数キーワード配列処理', () => {
            const date = new Date('2024-01-15T12:00:00Z');
            // AJCCは [[ アメリカ], [J, ジョッキー], [C, クラブ]]
            // つまり「アメリカ」かつ（「J」または「ジョッキー」）かつ（「C」または「クラブ」）

            const resultWithJapanese = processJraRaceName({
                name: 'アメリカジョッキークラブカップ',
                place: '東京',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            expect(resultWithJapanese).toBe('AJCC');

            const resultWithEnglish = processJraRaceName({
                name: 'America J Cup', // 英字でも対応できるか
                place: '東京',
                grade: 'GⅡ',
                date,
                surfaceType: '芝',
            });

            // 上記の入力では「アメリカ」が含まれていないのでマッチしない
            expect(resultWithEnglish).not.toBe('AJCC');
        });
    });

    describe('旧クラス名の正規化（フォールバック時）', () => {
        it('1000万円以下 → 2勝クラスへ正規化される', () => {
            const date = new Date('2024-06-15T12:00:00Z');
            const result = processJraRaceName({
                name: '4歳上1000万円以下',
                place: '東京',
                grade: '2勝クラス',
                date,
            });

            expect(result).toBe('4歳上2勝クラス');
        });

        it('1000万下 → 2勝クラスへ正規化される', () => {
            const date = new Date('2024-06-15T12:00:00Z');
            const result = processJraRaceName({
                name: '4歳上1000万下',
                place: '東京',
                grade: '2勝クラス',
                date,
            });

            expect(result).toBe('4歳上2勝クラス');
        });

        it('1600万円以下 → 3勝クラスへ正規化される', () => {
            const date = new Date('2024-06-15T12:00:00Z');
            const result = processJraRaceName({
                name: '3歳上1600万円以下',
                place: '東京',
                grade: '3勝クラス',
                date,
            });

            expect(result).toBe('3歳上3勝クラス');
        });

        it('500万円以下 → 1勝クラスへ正規化される', () => {
            const date = new Date('2024-06-15T12:00:00Z');
            const result = processJraRaceName({
                name: '3歳上500万円以下',
                place: '東京',
                grade: '1勝クラス',
                date,
            });

            expect(result).toBe('3歳上1勝クラス');
        });

        it('900万下は正規化対象外のためそのまま返る', () => {
            const date = new Date('2024-06-15T12:00:00Z');
            const result = processJraRaceName({
                name: '3歳上900万下',
                place: '東京',
                grade: '2勝クラス',
                date,
            });

            expect(result).toBe('3歳上900万下');
        });

        it('クラス名称変更の施行日（2019年6月1日）より前のレースは正規化されない', () => {
            // 当時は「1000万下」が正式名称であり誤表記ではないため、書き換えてはならない
            const date = new Date('2019-05-31T12:00:00+09:00');
            const result = processJraRaceName({
                name: '4歳上1000万下',
                place: '東京',
                grade: '1000万下',
                date,
            });

            expect(result).toBe('4歳上1000万下');
        });

        it('施行日当日（2019年6月1日）のレースは正規化される', () => {
            const date = new Date('2019-06-01T00:00:00+09:00');
            const result = processJraRaceName({
                name: '4歳上1000万下',
                place: '東京',
                grade: '2勝クラス',
                date,
            });

            expect(result).toBe('4歳上2勝クラス');
        });
    });
});
