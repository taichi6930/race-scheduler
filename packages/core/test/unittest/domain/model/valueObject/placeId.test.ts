/**
 * PlaceIdのテスト
 */
import { describe, expect, it } from 'bun:test';

import { validatePlaceId } from '../../../../../src/domain/model/valueObject/placeId';

/**
 * デシジョンテーブル: validatePlaceId
 *
 * placeIdの形式: {RaceType}{yyyymmdd}{location_code}
 *   - RaceType: jra | nar | keirin | overseas | autorace | boatrace (小文字)
 *   - yyyymmdd: 8桁の数字
 *   - location_code: 2桁の数字
 *
 * 正常系
 * | #  | 条件                                    | 入力例                   | 期待結果 |
 * |----|----------------------------------------|--------------------------|----------|
 * |  1 | RaceType=jra                           | "jra2025010501"          | 成功     |
 * |  2 | RaceType=nar                           | "nar2025010501"          | 成功     |
 * |  3 | RaceType=keirin                        | "keirin2025010501"       | 成功     |
 * |  4 | RaceType=overseas                      | "overseas2025010501"     | 成功     |
 * |  5 | RaceType=autorace                      | "autorace2025010501"     | 成功     |
 * |  6 | RaceType=boatrace                      | "boatrace2025010501"     | 成功     |
 * |  7 | location_code最小値(00)                | "jra2025010500"          | 成功     |
 * |  8 | location_code最大値(99)                | "jra2025010599"          | 成功     |
 * |  9 | 日付=年初(20250101)                    | "jra2025010101"          | 成功     |
 * | 10 | 日付=年末(20251231)                    | "jra2025123101"          | 成功     |
 *
 * 異常系（RaceType不正）
 * | #  | 条件                                    | 入力例                   | 期待結果 |
 * |----|----------------------------------------|--------------------------|----------|
 * | 11 | RaceType=大文字(JRA)                   | "JRA2025010501"          | エラー   |
 * | 12 | RaceType=未知の値                      | "abc2025010501"          | エラー   |
 * | 13 | RaceType=部分一致(jr)                  | "jr2025010501"           | エラー   |
 * | 14 | RaceType=混在大小文字(Jra)             | "Jra2025010501"          | エラー   |
 * | 15 | RaceType=無し                          | "2025010501"             | エラー   |
 *
 * 異常系（日付部分不正）
 * | #  | 条件                                    | 入力例                   | 期待結果 |
 * |----|----------------------------------------|--------------------------|----------|
 * | 16 | 日付部分が7桁（1桁不足）               | "jra202501051"           | エラー   |
 * | 17 | 日付部分が9桁（1桁超過）               | "jra2025010511"          | エラー   |
 * | 18 | 日付部分に英字混入                     | "jra2025A10501"          | エラー   |
 * | 19 | 日付部分が空                           | "jra01"                  | エラー   |
 *
 * 異常系（location_code不正）
 * | #  | 条件                                    | 入力例                   | 期待結果 |
 * |----|----------------------------------------|--------------------------|----------|
 * | 20 | location_codeが1桁                    | "jra20250105011"         | エラー（3桁になる） |
 * | 21 | location_codeが3桁                    | "jra202501050123"        | エラー（3桁余分）  |
 * | 22 | location_codeに英字混在               | "jra20250105AB"          | エラー   |
 * | 23 | location_codeが無し                   | "jra20250105"            | エラー   |
 *
 * 異常系（その他）
 * | #  | 条件                                    | 入力例                   | 期待結果 |
 * |----|----------------------------------------|--------------------------|----------|
 * | 24 | 空文字                                 | ""                       | エラー   |
 * | 25 | 末尾にスペース                         | "jra2025010501 "         | エラー   |
 * | 26 | 先頭にスペース                         | " jra2025010501"         | エラー   |
 * | 27 | 全て数字                               | "20250105011234"         | エラー   |
 */
describe('validatePlaceId', () => {
    // =========================================================================
    // 正常系
    // =========================================================================
    describe('正常系: 有効なplaceIdの場合、バリデーションが成功する', () => {
        describe('各RaceTypeが正しく受け付けられる', () => {
            it.each([
                ['jra', 'jra2025010501'],
                ['nar', 'nar2025010501'],
                ['keirin', 'keirin2025010501'],
                ['overseas', 'overseas2025010501'],
                ['autorace', 'autorace2025010501'],
                ['boatrace', 'boatrace2025010501'],
            ])(
                'RaceType=%s のplaceId "%s" はバリデーションを通過する',
                (_, placeId) => {
                    const result = validatePlaceId(placeId);
                    expect<string>(result).toBe(placeId);
                },
            );
        });

        describe('location_codeの境界値が正しく受け付けられる', () => {
            it('location_code最小値(00): "jra2025010500" はバリデーションを通過する', () => {
                const result = validatePlaceId('jra2025010500');
                expect<string>(result).toBe('jra2025010500');
            });

            it('location_code最大値(99): "jra2025010599" はバリデーションを通過する', () => {
                const result = validatePlaceId('jra2025010599');
                expect<string>(result).toBe('jra2025010599');
            });

            it('location_code中間値(50): "jra2025010550" はバリデーションを通過する', () => {
                const result = validatePlaceId('jra2025010550');
                expect<string>(result).toBe('jra2025010550');
            });
        });

        describe('日付の代表的な値が正しく受け付けられる', () => {
            it('年初(20250101): "jra2025010101" はバリデーションを通過する', () => {
                const result = validatePlaceId('jra2025010101');
                expect<string>(result).toBe('jra2025010101');
            });

            it('年末(20251231): "jra2025123101" はバリデーションを通過する', () => {
                const result = validatePlaceId('jra2025123101');
                expect<string>(result).toBe('jra2025123101');
            });
        });
    });

    // =========================================================================
    // 異常系: RaceType不正
    // =========================================================================
    describe('異常系: RaceType不正の場合、バリデーションが失敗する', () => {
        it('大文字のRaceType "JRA2025010501" はエラーになる（期待フォーマットを示すメッセージ付き）', () => {
            expect(() => validatePlaceId('JRA2025010501')).toThrow(
                /placeIdは.*形式で指定してください/,
            );
        });

        it('大文字のRaceType "NAR2025010501" はエラーになる', () => {
            expect(() => validatePlaceId('NAR2025010501')).toThrow();
        });

        it.each(['abc2025010501', 'xyz2025010501', 'horse2025010501'])(
            '未知のRaceType "%s" はエラーになる',
            (placeId) => {
                expect(() => validatePlaceId(placeId)).toThrow();
            },
        );

        it('部分一致(jr) "jr2025010501" はエラーになる', () => {
            expect(() => validatePlaceId('jr2025010501')).toThrow();
        });

        it('混在大小文字(Jra) "Jra2025010501" はエラーになる', () => {
            expect(() => validatePlaceId('Jra2025010501')).toThrow();
        });

        it('RaceType無し "2025010501" はエラーになる', () => {
            expect(() => validatePlaceId('2025010501')).toThrow();
        });
    });

    // =========================================================================
    // 異常系: 日付部分不正
    // =========================================================================
    describe('異常系: 日付部分が不正の場合、バリデーションが失敗する', () => {
        it('日付部分が7桁(1桁不足) "jra202501051" はエラーになる（期待フォーマットを示すメッセージ付き）', () => {
            // jra(3) + 202501(6) + 051(3) = location_codeが3桁になる
            expect(() => validatePlaceId('jra202501051')).toThrow(
                /placeIdは.*形式で指定してください/,
            );
        });

        it('日付部分が9桁(1桁超過) "jra202501050101" はエラーになる', () => {
            // location_code 4桁になるため不一致
            expect(() => validatePlaceId('jra202501050101')).toThrow();
        });

        it('日付部分に英字混入 "jra2025A10501" はエラーになる', () => {
            expect(() => validatePlaceId('jra2025A10501')).toThrow();
        });

        it('日付部分が空 "jra01" はエラーになる', () => {
            expect(() => validatePlaceId('jra01')).toThrow();
        });
    });

    // =========================================================================
    // 異常系: location_code不正
    // =========================================================================
    describe('異常系: location_codeが不正の場合、バリデーションが失敗する', () => {
        it('location_codeが1桁 "jra202501050" はエラーになる（期待フォーマットを示すメッセージ付き）', () => {
            expect(() => validatePlaceId('jra202501050')).toThrow(
                /placeIdは.*形式で指定してください/,
            );
        });

        it('location_codeが3桁 "jra202501050123" はエラーになる', () => {
            expect(() => validatePlaceId('jra202501050123')).toThrow();
        });

        it('location_codeに英字混在 "jra20250105AB" はエラーになる', () => {
            expect(() => validatePlaceId('jra20250105AB')).toThrow();
        });

        it('location_codeが無し "jra20250105" はエラーになる', () => {
            expect(() => validatePlaceId('jra20250105')).toThrow();
        });
    });

    // =========================================================================
    // 異常系: その他
    // =========================================================================
    describe('異常系: その他の不正な値の場合、バリデーションが失敗する', () => {
        it('空文字 "" はエラーになる（期待フォーマットを示すメッセージ付き）', () => {
            expect(() => validatePlaceId('')).toThrow(
                /placeIdは.*形式で指定してください/,
            );
        });

        it('末尾にスペース "jra2025010501 " はエラーになる', () => {
            expect(() => validatePlaceId('jra2025010501 ')).toThrow();
        });

        it('先頭にスペース " jra2025010501" はエラーになる', () => {
            expect(() => validatePlaceId(' jra2025010501')).toThrow();
        });

        it('全て数字 "20250105011234" はエラーになる', () => {
            expect(() => validatePlaceId('20250105011234')).toThrow();
        });
    });

    // =========================================================================
    // 境界値テスト
    // =========================================================================
    describe('境界値テスト', () => {
        describe('location_codeの境界値', () => {
            it('location_code=00 は成功する', () => {
                expect<string>(validatePlaceId('jra2025010500')).toBe(
                    'jra2025010500',
                );
            });

            it('location_code=99 は成功する', () => {
                expect<string>(validatePlaceId('jra2025010599')).toBe(
                    'jra2025010599',
                );
            });
        });

        describe('RaceTypeの長さバリエーション', () => {
            it('最短RaceType(jra=3文字) "jra2025010501" は成功する', () => {
                expect<string>(validatePlaceId('jra2025010501')).toBe(
                    'jra2025010501',
                );
            });

            it('最長RaceType(boatrace=8文字) "boatrace2025010501" は成功する', () => {
                expect<string>(validatePlaceId('boatrace2025010501')).toBe(
                    'boatrace2025010501',
                );
            });
        });

        describe('全RaceTypeで最小・最大location_codeの組み合わせ', () => {
            it.each([
                ['jra2025010500', 'jra2025010599'],
                ['nar2025010500', 'nar2025010599'],
                ['keirin2025010500', 'keirin2025010599'],
                ['overseas2025010500', 'overseas2025010599'],
                ['autorace2025010500', 'autorace2025010599'],
                ['boatrace2025010500', 'boatrace2025010599'],
            ])('min="%s", max="%s" どちらも成功する', (min, max) => {
                expect<string>(validatePlaceId(min)).toBe(min);
                expect<string>(validatePlaceId(max)).toBe(max);
            });
        });
    });

    // =========================================================================
    // 既知の制約（characterization test）: 暦日として不正な値も通ってしまう
    // =========================================================================
    describe('既知の制約: yyyymmdd部分は8桁数字のみで検証され、暦日として実在するかは検証しない', () => {
        it('13月を表す "jra2025139901" も正規表現的には成功してしまう', () => {
            // 本来存在しない13月・99日だが、フォーマットは RaceType+8桁数字+2桁数字 の
            // 正規表現一致のみで判定しており、暦日としての実在性は検証していない。
            // これは既知の制約であり、暦日検証を追加するかは仕様確認のうえ別途判断する
            // （docs/tasks/test-quality-audit.md P3-3）。ここでは現状の挙動を固定する。
            expect<string>(validatePlaceId('jra2025139901')).toBe(
                'jra2025139901',
            );
        });

        it('2月30日を表す "jra2025023001"（実在しない日付）も成功してしまう', () => {
            expect<string>(validatePlaceId('jra2025023001')).toBe(
                'jra2025023001',
            );
        });
    });
});
