/**
 * RaceIdのテスト
 */
import { describe, expect, it } from 'bun:test';

import {
    extractRaceTypeFromRaceId,
    validateRaceId,
} from '../../../../../src/domain/model/valueObject/raceId';
import { RaceType } from '../../../../../src/domain/model/valueObject/raceType';

/**
 * デシジョンテーブル: validateRaceId
 *
 * raceIdの形式: {RaceType}{yyyymmdd}{location_code}{race_number}
 *   - RaceType: jra | nar | keirin | overseas | autorace | boatrace
 *   - yyyymmdd: 8桁の数字
 *   - location_code: 2桁の数字
 *   - race_number: 2桁の数字
 *   ※ location_code と race_number は合わせて4桁の数字として末尾に続く
 *
 * 正常系
 * | #  | 条件                                         | 入力例                     | 期待結果 |
 * |----|----------------------------------------------|----------------------------|----------|
 * |  1 | RaceType=jra                                 | "jra202501050101"          | 成功     |
 * |  2 | RaceType=nar                                 | "nar202501050101"          | 成功     |
 * |  3 | RaceType=keirin                              | "keirin202501050101"       | 成功     |
 * |  4 | RaceType=overseas                            | "overseas202501050101"     | 成功     |
 * |  5 | RaceType=autorace                            | "autorace202501050101"     | 成功     |
 * |  6 | RaceType=boatrace                            | "boatrace202501050101"     | 成功     |
 * |  7 | location_code+race_number最小値(0000)        | "jra2025010500 00" →"jra202501050000" | 成功 |
 * |  8 | location_code+race_number最大値(9999)        | "jra202501059999"          | 成功     |
 * |  9 | location_code最小(00)+race_number最大(99)    | "jra2025010500 99" →"jra202501050099" | 成功 |
 * | 10 | location_code最大(99)+race_number最小(00)    | "jra202501059900"          | 成功     |
 * | 11 | 日付=年初(20250101)                          | "jra2025010101 01" →"jra202501010101" | 成功 |
 * | 12 | 日付=年末(20251231)                          | "jra2025123101 01" →"jra202512310101" | 成功 |
 *
 * 異常系（RaceType不正）
 * | #  | 条件                                         | 入力例                     | 期待結果 |
 * |----|----------------------------------------------|----------------------------|----------|
 * | 13 | RaceType=大文字(JRA)                         | "JRA202501050101"          | エラー   |
 * | 14 | RaceType=未知の値                            | "ABC202501050101"          | エラー   |
 * | 15 | RaceType=部分一致(JR)                        | "JR202501050101"           | エラー   |
 * | 16 | RaceType=混在大小文字(Jra)                   | "Jra202501050101"          | エラー   |
 * | 17 | RaceType=無し                               | "202501050101"             | エラー   |
 *
 * 異常系（日付部分不正）
 * | #  | 条件                                         | 入力例                     | 期待結果 |
 * |----|----------------------------------------------|----------------------------|----------|
 * | 18 | 日付部分が7桁(1桁不足)                       | "JRA20250105010"           | エラー   |
 * | 19 | 日付部分が9桁(1桁超過)                       | "JRA20250105010101"        | エラー   |
 * | 20 | 日付部分に英字混入                           | "JRA2025A1050101"          | エラー   |
 * | 21 | 日付部分が空                                | "JRA0101"                  | エラー   |
 *
 * 異常系（suffix桁数不正）
 * | #  | 条件                                         | 入力例                     | 期待結果 |
 * |----|----------------------------------------------|----------------------------|----------|
 * | 22 | suffix(location+race)が3桁                  | "JRA202501050101" (placeId) | エラー   |
 * | 23 | suffix(location+race)が5桁                  | "JRA20250105010101"        | エラー   |
 * | 24 | suffixに英字混在                            | "JRA20250105AB01"          | エラー   |
 * | 25 | suffixが無し                               | "JRA20250105"              | エラー   |
 *
 * 異常系（その他）
 * | #  | 条件                                         | 入力例                     | 期待結果 |
 * |----|----------------------------------------------|----------------------------|----------|
 * | 26 | 空文字                                       | ""                         | エラー   |
 * | 27 | 末尾にスペース                               | "JRA202501050101 "         | エラー   |
 * | 28 | 先頭にスペース                               | " JRA202501050101"         | エラー   |
 * | 29 | 全て数字                                    | "202501050101"             | エラー   |
 */
describe('validateRaceId', () => {
    // =========================================================================
    // 正常系
    // =========================================================================
    describe('正常系: 有効なraceIdの場合、バリデーションが成功する', () => {
        describe('各RaceTypeが正しく受け付けられる', () => {
            it.each([
                ['jra', 'jra202501050101'],
                ['nar', 'nar202501050101'],
                ['keirin', 'keirin202501050101'],
                ['overseas', 'overseas202501050101'],
                ['autorace', 'autorace202501050101'],
                ['boatrace', 'boatrace202501050101'],
            ])(
                'RaceType=%s のraceId "%s" はバリデーションを通過する',
                (_, raceId) => {
                    const result = validateRaceId(raceId);
                    expect<string>(result).toBe(raceId);
                },
            );
        });

        describe('location_code と race_number の境界値が正しく受け付けられる', () => {
            it('suffix最小値(0000): "jra202501050000" はバリデーションを通過する', () => {
                const result = validateRaceId('jra202501050000');
                expect<string>(result).toBe('jra202501050000');
            });

            it('suffix最大値(9999): "jra202501059999" はバリデーションを通過する', () => {
                const result = validateRaceId('jra202501059999');
                expect<string>(result).toBe('jra202501059999');
            });

            it('location_code最小(00)+race_number最大(99): "jra202501050099" はバリデーションを通過する', () => {
                const result = validateRaceId('jra202501050099');
                expect<string>(result).toBe('jra202501050099');
            });

            it('location_code最大(99)+race_number最小(00): "jra202501059900" はバリデーションを通過する', () => {
                const result = validateRaceId('jra202501059900');
                expect<string>(result).toBe('jra202501059900');
            });

            it('中間値: "jra202501055012" はバリデーションを通過する', () => {
                const result = validateRaceId('jra202501055012');
                expect<string>(result).toBe('jra202501055012');
            });
        });

        describe('日付の代表的な値が正しく受け付けられる', () => {
            it('年初(20250101): "jra202501010101" はバリデーションを通過する', () => {
                const result = validateRaceId('jra202501010101');
                expect<string>(result).toBe('jra202501010101');
            });

            it('年末(20251231): "jra202512310101" はバリデーションを通過する', () => {
                const result = validateRaceId('jra202512310101');
                expect<string>(result).toBe('jra202512310101');
            });
        });
    });

    // =========================================================================
    // 異常系: RaceType不正
    // =========================================================================
    describe('異常系: RaceType不正の場合、バリデーションが失敗する', () => {
        it('大文字のRaceType "JRA202501050101" はエラーになる（期待フォーマットを示すメッセージ付き）', () => {
            expect(() => validateRaceId('JRA202501050101')).toThrow(
                /raceIdは.*形式で指定してください/,
            );
        });

        it('大文字のRaceType "NAR202501050101" はエラーになる', () => {
            expect(() => validateRaceId('NAR202501050101')).toThrow();
        });

        it.each(['ABC202501050101', 'XYZ202501050101', 'HORSE202501050101'])(
            '未知のRaceType "%s" はエラーになる',
            (raceId) => {
                expect(() => validateRaceId(raceId)).toThrow();
            },
        );

        it('部分一致(JR) "JR202501050101" はエラーになる', () => {
            expect(() => validateRaceId('JR202501050101')).toThrow();
        });

        it('混在大小文字(Jra) "Jra202501050101" はエラーになる', () => {
            expect(() => validateRaceId('Jra202501050101')).toThrow();
        });

        it('RaceType無し "202501050101" はエラーになる', () => {
            expect(() => validateRaceId('202501050101')).toThrow();
        });
    });

    // =========================================================================
    // 異常系: 日付部分不正
    // =========================================================================
    describe('異常系: 日付部分が不正の場合、バリデーションが失敗する', () => {
        it('日付部分が7桁(1桁不足) "jra20250105010" はエラーになる（期待フォーマットを示すメッセージ付き）', () => {
            // jra(3) + 2025010(7) + 5010(4) → \d{8}に不一致
            expect(() => validateRaceId('jra20250105010')).toThrow(
                /raceIdは.*形式で指定してください/,
            );
        });

        it('日付部分が9桁(1桁超過): suffixが3桁になり不一致 "jra20250105010101" はエラーになる', () => {
            // jra(3) + 202501050(9) + 101(3) → \d{8}[0-9]{4}に不一致
            expect(() => validateRaceId('jra20250105010101')).toThrow();
        });

        it('日付部分に英字混入 "jra2025A1050101" はエラーになる', () => {
            expect(() => validateRaceId('jra2025A1050101')).toThrow();
        });

        it('日付部分が空 "jra0101" はエラーになる', () => {
            expect(() => validateRaceId('jra0101')).toThrow();
        });
    });

    // =========================================================================
    // 異常系: suffix桁数不正
    // =========================================================================
    describe('異常系: suffixの桁数が不正の場合、バリデーションが失敗する', () => {
        it('suffixが2桁(placeId形式) "jra2025010501" はエラーになる（期待フォーマットを示すメッセージ付き）', () => {
            // placeIdはraceIdとして無効（suffixが2桁、4桁必要）
            expect(() => validateRaceId('jra2025010501')).toThrow(
                /raceIdは.*形式で指定してください/,
            );
        });

        it('suffixが3桁 "jra20250105010" はエラーになる', () => {
            expect(() => validateRaceId('jra20250105010')).toThrow();
        });

        it('suffixが5桁 "jra20250105010101" はエラーになる', () => {
            expect(() => validateRaceId('jra20250105010101')).toThrow();
        });

        it('suffixに英字混在 "jra20250105AB01" はエラーになる', () => {
            expect(() => validateRaceId('jra20250105AB01')).toThrow();
        });

        it('suffixに英字混在 "jra2025010501CD" はエラーになる', () => {
            expect(() => validateRaceId('jra2025010501CD')).toThrow();
        });

        it('suffixが無し "jra20250105" はエラーになる', () => {
            expect(() => validateRaceId('jra20250105')).toThrow();
        });
    });

    // =========================================================================
    // 異常系: その他
    // =========================================================================
    describe('異常系: その他の不正な値の場合、バリデーションが失敗する', () => {
        it('空文字 "" はエラーになる（期待フォーマットを示すメッセージ付き）', () => {
            expect(() => validateRaceId('')).toThrow(
                /raceIdは.*形式で指定してください/,
            );
        });

        it('末尾にスペース "jra202501050101 " はエラーになる', () => {
            expect(() => validateRaceId('jra202501050101 ')).toThrow();
        });

        it('先頭にスペース " jra202501050101" はエラーになる', () => {
            expect(() => validateRaceId(' jra202501050101')).toThrow();
        });

        it('全て数字 "202501050101" はエラーになる', () => {
            expect(() => validateRaceId('202501050101')).toThrow();
        });
    });

    // =========================================================================
    // 境界値テスト
    // =========================================================================
    describe('境界値テスト', () => {
        describe('suffix(location_code + race_number)の境界値', () => {
            it('suffix=0000 は成功する', () => {
                expect<string>(validateRaceId('jra202501050000')).toBe(
                    'jra202501050000',
                );
            });

            it('suffix=9999 は成功する', () => {
                expect<string>(validateRaceId('jra202501059999')).toBe(
                    'jra202501059999',
                );
            });
        });

        describe('RaceTypeの長さバリエーション', () => {
            it('最短RaceType(jra=3文字) "jra202501050101" は成功する', () => {
                expect<string>(validateRaceId('jra202501050101')).toBe(
                    'jra202501050101',
                );
            });

            it('最長RaceType(boatrace=8文字) "boatrace202501050101" は成功する', () => {
                expect<string>(validateRaceId('boatrace202501050101')).toBe(
                    'boatrace202501050101',
                );
            });
        });

        describe('placeIdとraceIdの区別（形式の違い）', () => {
            it('placeId形式(suffix2桁) "jra2025010501" はraceIdとしてエラーになる', () => {
                // placeIdはsuffix2桁、raceIdはsuffix4桁が必要
                expect(() => validateRaceId('jra2025010501')).toThrow();
            });

            it('raceId形式(suffix4桁) "jra202501050101" は成功する', () => {
                expect<string>(validateRaceId('jra202501050101')).toBe(
                    'jra202501050101',
                );
            });
        });

        describe('全RaceTypeで最小・最大suffixの組み合わせ', () => {
            it.each([
                ['jra202501050000', 'jra202501059999'],
                ['nar202501050000', 'nar202501059999'],
                ['keirin202501050000', 'keirin202501059999'],
                ['overseas202501050000', 'overseas202501059999'],
                ['autorace202501050000', 'autorace202501059999'],
                ['boatrace202501050000', 'boatrace202501059999'],
            ])('min="%s", max="%s" どちらも成功する', (min, max) => {
                expect<string>(validateRaceId(min)).toBe(min);
                expect<string>(validateRaceId(max)).toBe(max);
            });
        });
    });

    // =========================================================================
    // 既知の制約（characterization test）: 暦日として不正な値も通ってしまう
    // =========================================================================
    describe('既知の制約: yyyymmdd部分は8桁数字のみで検証され、暦日として実在するかは検証しない', () => {
        it('13月を表す "jra202513990101" も正規表現的には成功してしまう', () => {
            // placeId.test.ts と同様、暦日としての実在性は検証していない既知の制約。
            // 暦日検証を追加するかは仕様確認のうえ別途判断する
            // （docs/tasks/test-quality-audit.md P3-3）。ここでは現状の挙動を固定する。
            expect<string>(validateRaceId('jra202513990101')).toBe(
                'jra202513990101',
            );
        });

        it('2月30日を表す "jra202502300101"（実在しない日付）も成功してしまう', () => {
            expect<string>(validateRaceId('jra202502300101')).toBe(
                'jra202502300101',
            );
        });
    });
});

/**
 * デシジョンテーブル: extractRaceTypeFromRaceId
 *
 * | # | 条件 | 入力例 | 期待結果 |
 * |---|------|--------|----------|
 * | 1 | RaceType=jra（3文字接頭辞） | "jra202501050101" | RaceType.JRA |
 * | 2 | RaceType=nar | "nar202501050101" | RaceType.NAR |
 * | 3 | RaceType=keirin | "keirin202501050101" | RaceType.KEIRIN |
 * | 4 | RaceType=overseas | "overseas202501050101" | RaceType.OVERSEAS |
 * | 5 | RaceType=autorace | "autorace202501050101" | RaceType.AUTORACE |
 * | 6 | RaceType=boatrace（8文字接頭辞） | "boatrace202501050101" | RaceType.BOATRACE |
 * | 7 | 未知の接頭辞 | "unknown202501050101" | エラー |
 */
describe('extractRaceTypeFromRaceId', () => {
    it.each([
        ['jra202501050101', RaceType.JRA],
        ['nar202501050101', RaceType.NAR],
        ['keirin202501050101', RaceType.KEIRIN],
        ['overseas202501050101', RaceType.OVERSEAS],
        ['autorace202501050101', RaceType.AUTORACE],
        ['boatrace202501050101', RaceType.BOATRACE],
    ])('raceId "%s" からraceType "%s" を取り出す', (raceId, expected) => {
        expect(extractRaceTypeFromRaceId(raceId)).toBe(expected);
    });

    it('未知の接頭辞を持つraceIdはエラーになる', () => {
        expect(() =>
            extractRaceTypeFromRaceId('unknown202501050101'),
        ).toThrow();
    });
});
