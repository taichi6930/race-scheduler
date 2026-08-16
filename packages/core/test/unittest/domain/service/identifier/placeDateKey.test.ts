/**
 * derivePlaceDateKey のテスト
 *
 * ## デシジョンテーブル
 *
 * derivePlaceDateKey は分岐を持たない単純な文字列スライスのため、
 * C0/C1 は代表的な入力を1件通せば満たされる。以下は仕様の網羅性を
 * 示すための代表ケース（raceType違い・raceNumber2桁違い）。
 *
 * | #    | raceId                  | 期待キー（raceId末尾2桁を除いた部分） |
 * |------|-------------------------|----------------------------------------|
 * | T-01 | jra202601270601         | jra2026012706                           |
 * | T-02 | nar202603151512         | nar2026031515                           |
 * | T-03 | keirin2026060101 + '05' | keirin2026060101                        |
 */
import { describe, expect, it } from 'bun:test';

import { validateRaceId } from '../../../../../src/domain/model/valueObject/raceId';
import { derivePlaceDateKey } from '../../../../../src/domain/service/identifier/placeDateKey';

describe('derivePlaceDateKey', () => {
    it.each([
        [
            '[T-01] raceId "jra202601270601" から開催場・日付キー "jra2026012706" を導出する',
            'jra202601270601',
            'jra2026012706',
        ],
        [
            '[T-02] raceId "nar202603151512" から開催場・日付キー "nar2026031515" を導出する',
            'nar202603151512',
            'nar2026031515',
        ],
        [
            '[T-03] raceId "keirin202606010105" から開催場・日付キー "keirin2026060101" を導出する',
            'keirin202606010105',
            'keirin2026060101',
        ],
    ])('%s', (_title, raceId, expectedKey) => {
        const result = derivePlaceDateKey(validateRaceId(raceId));

        expect(result).toBe(expectedKey);
    });

    it('同一開催・異なるraceNumberのraceIdは同じキーになる', () => {
        const race1 = derivePlaceDateKey(validateRaceId('jra202601270601'));
        const race2 = derivePlaceDateKey(validateRaceId('jra202601270612'));

        expect(race1).toBe(race2);
    });
});
