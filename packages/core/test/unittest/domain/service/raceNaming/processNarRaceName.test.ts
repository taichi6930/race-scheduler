/**
 * processNarRaceName ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | processNarRaceName | 全角文字 | 半角に変換（S10） | Line |
 * | 2  | processNarRaceName | ステークス | S に変換（ダービーS） | Line |
 * | 3  | processNarRaceName | 西日本3歳優駿 | 特別ハンドラー実行 | Line |
 * | 4  | processNarRaceName | 帯広ば競馬 | 帯広ルール適用 | Line |
 * | 5  | processNarRaceName | 門別競馬 | 門別ルール適用 | Line |
 * | 6  | processNarRaceName | 水沢競馬 | 水沢ルール + special | Line |
 * | 7  | processNarRaceName | 盛岡競馬 | 盛岡ルール + special | Line |
 * | 8  | processNarRaceName | 浦和競馬 | 浦和ルール適用 | Line |
 * | 9  | processNarRaceName | 船橋競馬 | 船橋ルール適用 | Line |
 * | 10 | processNarRaceName | 川崎競馬 | 川崎ルール適用 | Line |
 * | 11 | processNarRaceName | 名古屋競馬 | 名古屋ルール適用 | Line |
 * | 12 | processNarRaceName | 笠松競馬 | 笠松ルール + special | Line |
 * | 13 | processNarRaceName | 園田競馬 | 園田ルール適用 | Line |
 * | 14 | processNarRaceName | 姫路競馬 | 姫路ルール適用 | Line |
 * | 15 | processNarRaceName | 高知競馬 | 高知ルール適用 | Line |
 * | 16 | processNarRaceName | 佐賀競馬 | 佐賀ルール適用 | Line |
 * | 17 | processNarRaceName | 未定義場所 | ルール未適用 | Line |
 * | 18 | processNarRaceName | 末尾に(準重賞(3上)等の丸括弧書きグレード表記 | 括弧ごと削除（Issue #2460） | Line |
 * | 19 | processNarRaceName | 置換の結果、前後に空白だけが残る名称 | 前後の空白を除去 | Line |
 */

import { describe, expect, it } from 'bun:test';
import { processNarRaceName, type RaceCourse } from '@race-schedule/core';

describe('processNarRaceName', () => {
    describe('共通ルール処理', () => {
        it('全角数字を半角に変換', () => {
            const result = processNarRaceName({
                name: 'ステークス１０',
                place: '帯広ば',
            });

            expect(result).toBe('S10');
        });

        it('ステークスをSに変換', () => {
            const result = processNarRaceName({
                name: 'ダービーステークス',
                place: '帯広ば',
            });

            expect(result).toBe('ダービーS');
        });

        it('カップをCに変換', () => {
            const result = processNarRaceName({
                name: 'ゴールドカップ',
                place: '佐賀',
            });

            expect(result).toBe('ゴールドC');
        });

        it('J交指認 を削除', () => {
            const result = processNarRaceName({
                name: 'J交 テストレース',
                place: '帯広ば',
            });

            expect(result).toBe('テストレース');
        });

        it('全角空白を半角に変換', () => {
            const result = processNarRaceName({
                name: 'テスト　レース',
                place: '帯広ば',
            });

            expect(result).toBe('テスト レース');
        });

        it('第N回を削除（すべての競馬場で共通）', () => {
            const result = processNarRaceName({
                name: '第26回名古屋グランプリ',
                place: '名古屋',
            });

            expect(result).toBe('名古屋グランプリ');
        });

        it('丸括弧書きの(準重賞...)を削除（Issue #2460）', () => {
            const result = processNarRaceName({
                name: 'ヴィーナスサマースプリント(準重賞(3上)',
                place: '大井',
            });

            expect(result).toBe('ヴィーナスサマースプリント');
        });

        it('丸括弧書きの(重賞...)を削除', () => {
            const result = processNarRaceName({
                name: 'テストレース(重賞(3上)',
                place: '大井',
            });

            expect(result).toBe('テストレース');
        });
    });

    describe('特別レース判定', () => {
        it('西日本3歳優駿を判定', () => {
            const result = processNarRaceName({
                name: 'JRA 西日本3歳優駿',
                place: '佐賀',
            });

            expect(result).toBe('西日本3歳優駿');
        });

        it('西日本ダービーを判定', () => {
            const result = processNarRaceName({
                name: 'JRA 西日本ダービー',
                place: '佐賀',
            });

            expect(result).toBe('西日本ダービー');
        });
    });

    describe('帯広ば競馬', () => {
        it('ヤングチャンピオンシップを判定', () => {
            const result = processNarRaceName({
                name: '3歳牡馬ヤングチャンピオンシップ',
                place: '帯広ば',
            });

            expect(result).toBe('ヤングチャンピオンシップ');
        });

        it('年齢と性別を削除', () => {
            const result = processNarRaceName({
                name: '2歳牡馬オープン',
                place: '帯広ば',
            });

            expect(result).toBe('');
        });
    });

    describe('門別競馬', () => {
        it('ブリーダーズゴールドジュニアをブリーダーズゴールドジュニアCに変換', () => {
            const result = processNarRaceName({
                name: '2歳ブリーダーズゴールドジュニア',
                place: '門別',
            });

            expect(result).toBe('ブリーダーズゴールドジュニアC');
        });

        it('準重賞を削除', () => {
            const result = processNarRaceName({
                name: '〔準重賞〕テストレース',
                place: '門別',
            });

            expect(result).toBe('');
        });
    });

    describe('水沢競馬', () => {
        it('スペシャルハンドラー：2歳を判定', () => {
            const result = processNarRaceName({
                name: '2歳',
                place: '水沢',
            });

            expect(result).toBe('2歳');
        });

        it('岩手県知事杯OROをカップに変換', () => {
            const result = processNarRaceName({
                name: 'ＪＲＡ 岩手県知事杯ORO',
                place: '水沢',
            });

            expect(result).toBe('岩手県知事杯OROカップ');
        });

        it('南部杯をMCS南部杯に変換', () => {
            const result = processNarRaceName({
                name: 'テスト南部杯テスト',
                place: '水沢',
            });

            expect(result).toBe('MCS南部杯');
        });

        it('スプリングをスプリングC（岩手）に変換', () => {
            const result = processNarRaceName({
                name: 'スプリングレース',
                place: '水沢',
            });

            expect(result).toBe('スプリングC（岩手）');
        });
    });

    describe('盛岡競馬', () => {
        it('盛岡も水沢と同じルールを適用', () => {
            const result = processNarRaceName({
                name: 'テスト南部杯',
                place: '盛岡',
            });

            expect(result).toBe('MCS南部杯');
        });

        it('盛岡スペシャルハンドラー：2歳', () => {
            const result = processNarRaceName({
                name: '2歳',
                place: '盛岡',
            });

            expect(result).toBe('2歳');
        });
    });

    describe('浦和競馬', () => {
        it('3歳未格選抜馬を削除', () => {
            const result = processNarRaceName({
                name: '3歳未格選抜馬テスト',
                place: '浦和',
            });

            expect(result).toBe('テスト');
        });

        it('A2・B1を削除', () => {
            const result = processNarRaceName({
                name: 'A2・B1テスト',
                place: '浦和',
            });

            expect(result).toBe('');
        });

        it('オープン4上をオープンに変換', () => {
            const result = processNarRaceName({
                name: 'オープン4上',
                place: '浦和',
            });

            expect(result).toBe('オープン');
        });
    });

    describe('船橋競馬', () => {
        it('船橋も浦和と同じルールを適用', () => {
            const result = processNarRaceName({
                name: 'A2テスト',
                place: '船橋',
            });

            expect(result).toBe('');
        });

        it('オープン配置を削除', () => {
            const result = processNarRaceName({
                name: '3上オープン',
                place: '船橋',
            });

            expect(result).toBe('');
        });
    });

    describe('川崎競馬', () => {
        it('地方交流3歳を削除', () => {
            const result = processNarRaceName({
                name: '【地方交流3歳テスト',
                place: '川崎',
            });

            expect(result).toBe('テスト');
        });

        it('年齢とオープン配置を削除', () => {
            const result = processNarRaceName({
                name: '3上牝馬オープン',
                place: '川崎',
            });

            expect(result).toBe('');
        });

        it('あすなろ杯を判定', () => {
            const result = processNarRaceName({
                name: 'テストあすなろ杯テスト',
                place: '川崎',
            });

            expect(result).toBe('テストあすなろ杯テスト');
        });

        it('交流レースを処理', () => {
            const result = processNarRaceName({
                name: '【国際交流】テスト',
                place: '川崎',
            });

            expect(result).toBe('');
        });

        it('4歳上を削除', () => {
            const result = processNarRaceName({
                name: 'テスト4歳上',
                place: '川崎',
            });

            expect(result).toBe('テスト');
        });
    });

    describe('名古屋競馬', () => {
        it('名古屋競馬ルールを適用', () => {
            const result = processNarRaceName({
                name: 'テストネクストスター',
                place: '名古屋',
            });

            expect(result).toBe('ネクストスター名古屋');
        });

        it('B/BCサフィックスを削除', () => {
            const result = processNarRaceName({
                name: 'テストB',
                place: '名古屋',
            });

            expect(result).toBe('テスト');
        });
    });

    describe('笠松競馬', () => {
        it('スペシャルハンドラー：ゴールドジュニア', () => {
            const result = processNarRaceName({
                name: 'ゴールドジュニア',
                place: '笠松',
            });

            expect(result).toBe('ゴールドジュニア（笠松）');
        });

        it('スペシャルハンドラー：東海ゴールド', () => {
            const result = processNarRaceName({
                name: '東海ゴールド',
                place: '笠松',
            });

            expect(result).toBe('東海ゴールドC');
        });

        it('年齢とオープン配置を削除', () => {
            const result = processNarRaceName({
                name: '3歳オープン',
                place: '笠松',
            });

            expect(result).toBe('');
        });
    });

    describe('園田競馬', () => {
        it('園田ルールを適用', () => {
            const result = processNarRaceName({
                name: '2歳牝馬',
                place: '園田',
            });

            expect(result).toBe('');
        });
    });

    describe('姫路競馬', () => {
        it('姫路も園田と同じルールを適用', () => {
            const result = processNarRaceName({
                name: '3歳テスト',
                place: '姫路',
            });

            expect(result).toBe('');
        });
    });

    describe('高知競馬', () => {
        it('年齢を削除', () => {
            const result = processNarRaceName({
                name: '2歳レース',
                place: '高知',
            });

            expect(result).toBe('');
        });

        it('B級以下を削除', () => {
            const result = processNarRaceName({
                name: 'テストB級以下',
                place: '高知',
            });

            expect(result).toBe('テスト');
        });

        it('C級以下を削除', () => {
            const result = processNarRaceName({
                name: 'テストC級以下',
                place: '高知',
            });

            expect(result).toBe('テスト');
        });

        // 回帰テスト: 「歳」を含まないクラス表記（C3-15等）の数字が、年齢条件と
        // 誤認識されて削られないこと。修正前は「歳?」（任意）だったため
        // "C3-15" の "3" が [2-4] にマッチし、後続の ".*" ごと "C" だけに
        // 削られていた（2026年1〜8月の公式CSVで高知の開催日の99%が
        // 複数レース名の衝突を起こしていた）。
        it('歳を含まないクラス+番号表記は削らない（回帰: 年齢条件との誤認識）', () => {
            const result = processNarRaceName({
                name: 'C3-15',
                place: '高知',
            });

            expect(result).toBe('C3-15');
        });

        it('固有名詞のレース名からは年齢条件だけを削り本体は残す', () => {
            const result = processNarRaceName({
                name: '四万十川特別4歳以上B級以下',
                place: '高知',
            });

            expect(result).toBe('四万十川特別');
        });
    });

    describe('佐賀競馬', () => {
        it('九州産を削除', () => {
            const result = processNarRaceName({
                name: 'テスト九州産',
                place: '佐賀',
            });

            expect(result).toBe('テスト');
        });

        it('オープンを削除', () => {
            const result = processNarRaceName({
                name: 'テストオープン',
                place: '佐賀',
            });

            expect(result).toBe('テスト');
        });

        it('A1/B条件を削除', () => {
            const result = processNarRaceName({
                name: 'テストA1・B',
                place: '佐賀',
            });

            expect(result).toBe('テスト');
        });

        it('年齢条件を削除', () => {
            const result = processNarRaceName({
                name: 'テスト3歳',
                place: '佐賀',
            });

            expect(result).toBe('テスト');
        });
    });

    describe('未定義場所', () => {
        it('未定義場所ではルール未適用', () => {
            const result = processNarRaceName({
                name: 'テストレース',
                place: 'unknown' as RaceCourse,
            });

            expect(result).toBe('テストレース');
        });
    });

    // 19: 置換の結果レース名の前後に区切りの空白だけが残るケース。
    // 4つある return のいずれを通っても除去されることを確認する。
    describe('前後空白の除去', () => {
        it('回次表記の除去で先頭に残る空白を除去（場所固有ルール経由）', () => {
            const result = processNarRaceName({
                name: '第６０回 黒潮盃３歳選定馬重賞',
                place: '大井',
            });

            expect(result).toBe('黒潮盃');
        });

        it('クラス表記の除去で末尾に残る空白を除去（場所固有ルール経由）', () => {
            const result = processNarRaceName({
                name: 'テストレース A1・B',
                place: '佐賀',
            });

            expect(result).toBe('テストレース');
        });

        it('場所固有ルールが無い場合も前後空白を除去（早期return経由）', () => {
            const result = processNarRaceName({
                name: '  テストレース  ',
                place: 'unknown' as RaceCourse,
            });

            expect(result).toBe('テストレース');
        });
    });
});
