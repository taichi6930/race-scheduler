/**
 * raceType テスト
 *
 * ## デシジョンテーブル: validateRaceType
 *
 * | # | input       | 期待結果                    |
 * |---|-------------|------------------------------|
 * | 1 | 'jra'       | RaceType.JRA を返す         |
 * | 2 | 'nar'       | RaceType.NAR を返す         |
 * | 3 | 'keirin'    | RaceType.KEIRIN を返す      |
 * | 4 | 'overseas'  | RaceType.OVERSEAS を返す    |
 * | 5 | 'autorace'  | RaceType.AUTORACE を返す    |
 * | 6 | 'boatrace'  | RaceType.BOATRACE を返す    |
 * | 7 | 'JRA'（大文字）| RaceType.JRA を返す（小文字変換後）|
 * | 8 | 'invalid'   | エラーをスロー              |
 * | 9 | ''          | エラーをスロー              |
 *
 * ## デシジョンテーブル: isIncludedRaceType
 *
 * | # | raceType       | raceTypeList             | 期待結果  |
 * |---|----------------|--------------------------|-----------|
 * | 10| RaceType.JRA   | [JRA]                    | true      |
 * | 11| RaceType.NAR   | [JRA, NAR]               | true      |
 * | 12| RaceType.JRA   | [NAR, KEIRIN]            | false     |
 * | 13| RaceType.JRA   | []                       | false     |
 */

import { describe, expect, it } from 'bun:test';

import {
    isIncludedRaceType,
    RaceType,
    validateRaceType,
} from '../../../../../src/domain/model/valueObject/raceType';

describe('validateRaceType', () => {
    describe('正常系: 有効なレース種別', () => {
        it('ケース#1: jra は RaceType.JRA を返す', () => {
            expect(validateRaceType('jra')).toBe(RaceType.JRA);
        });

        it('ケース#2: nar は RaceType.NAR を返す', () => {
            expect(validateRaceType('nar')).toBe(RaceType.NAR);
        });

        it('ケース#3: keirin は RaceType.KEIRIN を返す', () => {
            expect(validateRaceType('keirin')).toBe(RaceType.KEIRIN);
        });

        it('ケース#4: overseas は RaceType.OVERSEAS を返す', () => {
            expect(validateRaceType('overseas')).toBe(RaceType.OVERSEAS);
        });

        it('ケース#5: autorace は RaceType.AUTORACE を返す', () => {
            expect(validateRaceType('autorace')).toBe(RaceType.AUTORACE);
        });

        it('ケース#6: boatrace は RaceType.BOATRACE を返す', () => {
            expect(validateRaceType('boatrace')).toBe(RaceType.BOATRACE);
        });

        it('ケース#7: 大文字入力は小文字変換後にパースされる', () => {
            expect(validateRaceType('JRA')).toBe(RaceType.JRA);
        });

        it('大文字小文字混在でもパースされる', () => {
            expect(validateRaceType('Keirin')).toBe(RaceType.KEIRIN);
        });
    });

    describe('異常系: 無効なレース種別', () => {
        it('ケース#8: 存在しない種別はエラーをスロー', () => {
            expect(() => validateRaceType('invalid')).toThrow(
                'Invalid race_type: invalid',
            );
        });

        it('ケース#9: 空文字はエラーをスロー', () => {
            expect(() => validateRaceType('')).toThrow('Invalid race_type:');
        });
    });
});

describe('isIncludedRaceType', () => {
    describe('正常系: リストに含まれる場合', () => {
        it('ケース#10: raceType がリストの唯一の要素と一致する場合は true', () => {
            expect(isIncludedRaceType(RaceType.JRA, [RaceType.JRA])).toBe(true);
        });

        it('ケース#11: raceType が複数のリストに含まれる場合は true', () => {
            expect(
                isIncludedRaceType(RaceType.NAR, [RaceType.JRA, RaceType.NAR]),
            ).toBe(true);
        });
    });

    describe('正常系: リストに含まれない場合', () => {
        it('ケース#12: raceType がリストに含まれない場合は false', () => {
            expect(
                isIncludedRaceType(RaceType.JRA, [
                    RaceType.NAR,
                    RaceType.KEIRIN,
                ]),
            ).toBe(false);
        });

        it('ケース#13: 空リストでは常に false', () => {
            expect(isIncludedRaceType(RaceType.JRA, [])).toBe(false);
        });

        it('全種別が含まれないリストでは false', () => {
            expect(
                isIncludedRaceType(RaceType.OVERSEAS, [
                    RaceType.AUTORACE,
                    RaceType.BOATRACE,
                ]),
            ).toBe(false);
        });
    });
});
