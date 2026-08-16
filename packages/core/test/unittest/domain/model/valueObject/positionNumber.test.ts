/**
 * domain/model/valueObject/positionNumber テスト
 *
 * ## デシジョンテーブル: PositionNumberSchema(raceType).safeParse(value)
 *
 * 枠番（PositionNumber）の上限値は RaceType ごとに異なる
 * （`maxFrameNumber`: BOATRACE=6, AUTORACE=8, KEIRIN=9, JRA=18, NAR=16, OVERSEAS=48）。
 * 各 RaceType について「下限未満（0）」「下限（1）」「上限」「上限超過」の境界を検証する。
 *
 * | #    | raceType | value | 期待     |
 * |------|----------|-------|----------|
 * | T-01 | BOATRACE | 0     | NG（1未満）|
 * | T-02 | BOATRACE | 1     | OK       |
 * | T-03 | BOATRACE | 6     | OK（上限）|
 * | T-04 | BOATRACE | 7     | NG（上限超過）|
 * | T-05 | AUTORACE | 0     | NG（1未満）|
 * | T-06 | AUTORACE | 1     | OK       |
 * | T-07 | AUTORACE | 8     | OK（上限）|
 * | T-08 | AUTORACE | 9     | NG（上限超過）|
 * | T-09 | KEIRIN   | 0     | NG（1未満）|
 * | T-10 | KEIRIN   | 1     | OK       |
 * | T-11 | KEIRIN   | 9     | OK（上限）|
 * | T-12 | KEIRIN   | 10    | NG（上限超過）|
 * | T-13 | JRA      | 0     | NG（1未満）|
 * | T-14 | JRA      | 1     | OK       |
 * | T-15 | JRA      | 18    | OK（上限）|
 * | T-16 | JRA      | 19    | NG（上限超過）|
 * | T-17 | NAR      | 0     | NG（1未満）|
 * | T-18 | NAR      | 1     | OK       |
 * | T-19 | NAR      | 16    | OK（上限）|
 * | T-20 | NAR      | 17    | NG（上限超過）|
 * | T-21 | OVERSEAS | 0     | NG（1未満）|
 * | T-22 | OVERSEAS | 1     | OK       |
 * | T-23 | OVERSEAS | 48    | OK（上限）|
 * | T-24 | OVERSEAS | 49    | NG（上限超過）|
 * | T-25 | JRA      | 1.5   | NG（非整数）|
 * | T-26 | JRA      | -1    | NG（負数）|
 *
 * ## デシジョンテーブル: PositionNumberSchema(raceType).parse(value) のエラーメッセージ
 *
 * | #    | raceType | value | 期待メッセージ                       |
 * |------|----------|-------|----------------------------------------|
 * | T-27 | BOATRACE | 0     | '枠番は1以上である必要があります'      |
 * | T-28 | BOATRACE | 7     | '枠番は6以下である必要があります'      |
 * | T-29 | JRA      | 19    | '枠番は18以下である必要があります'     |
 */
import { describe, expect, it } from 'bun:test';

import { PositionNumberSchema } from '../../../../../src/domain/model/valueObject/positionNumber';
import { RaceType } from '../../../../../src/domain/model/valueObject/raceType';

describe('PositionNumberSchema', () => {
    describe('全RaceTypeの境界値検証', () => {
        it.each([
            ['[T-01] BOATRACE・0 → NG（1未満）', RaceType.BOATRACE, 0, false],
            ['[T-02] BOATRACE・1 → OK', RaceType.BOATRACE, 1, true],
            ['[T-03] BOATRACE・6（上限）→ OK', RaceType.BOATRACE, 6, true],
            ['[T-04] BOATRACE・7（上限超過）→ NG', RaceType.BOATRACE, 7, false],
            ['[T-05] AUTORACE・0 → NG（1未満）', RaceType.AUTORACE, 0, false],
            ['[T-06] AUTORACE・1 → OK', RaceType.AUTORACE, 1, true],
            ['[T-07] AUTORACE・8（上限）→ OK', RaceType.AUTORACE, 8, true],
            ['[T-08] AUTORACE・9（上限超過）→ NG', RaceType.AUTORACE, 9, false],
            ['[T-09] KEIRIN・0 → NG（1未満）', RaceType.KEIRIN, 0, false],
            ['[T-10] KEIRIN・1 → OK', RaceType.KEIRIN, 1, true],
            ['[T-11] KEIRIN・9（上限）→ OK', RaceType.KEIRIN, 9, true],
            ['[T-12] KEIRIN・10（上限超過）→ NG', RaceType.KEIRIN, 10, false],
            ['[T-13] JRA・0 → NG（1未満）', RaceType.JRA, 0, false],
            ['[T-14] JRA・1 → OK', RaceType.JRA, 1, true],
            ['[T-15] JRA・18（上限）→ OK', RaceType.JRA, 18, true],
            ['[T-16] JRA・19（上限超過）→ NG', RaceType.JRA, 19, false],
            ['[T-17] NAR・0 → NG（1未満）', RaceType.NAR, 0, false],
            ['[T-18] NAR・1 → OK', RaceType.NAR, 1, true],
            ['[T-19] NAR・16（上限）→ OK', RaceType.NAR, 16, true],
            ['[T-20] NAR・17（上限超過）→ NG', RaceType.NAR, 17, false],
            ['[T-21] OVERSEAS・0 → NG（1未満）', RaceType.OVERSEAS, 0, false],
            ['[T-22] OVERSEAS・1 → OK', RaceType.OVERSEAS, 1, true],
            ['[T-23] OVERSEAS・48（上限）→ OK', RaceType.OVERSEAS, 48, true],
            [
                '[T-24] OVERSEAS・49（上限超過）→ NG',
                RaceType.OVERSEAS,
                49,
                false,
            ],
            ['[T-25] JRA・1.5（非整数）→ NG', RaceType.JRA, 1.5, false],
            ['[T-26] JRA・-1（負数）→ NG', RaceType.JRA, -1, false],
        ])('%s', (_title, raceType, value, expectedSuccess) => {
            const result = PositionNumberSchema(raceType).safeParse(value);

            expect(result.success).toBe(expectedSuccess);
        });
    });

    describe('エラーメッセージがraceType・上限値ごとに正しいこと', () => {
        it.each([
            [
                '[T-27] BOATRACE・0 → 下限エラーメッセージ',
                RaceType.BOATRACE,
                0,
                '枠番は1以上である必要があります',
            ],
            [
                '[T-28] BOATRACE・7 → 上限エラーメッセージ（上限6）',
                RaceType.BOATRACE,
                7,
                '枠番は6以下である必要があります',
            ],
            [
                '[T-29] JRA・19 → 上限エラーメッセージ（上限18）',
                RaceType.JRA,
                19,
                '枠番は18以下である必要があります',
            ],
        ])('%s', (_title, raceType, value, expectedMessage) => {
            expect(() => PositionNumberSchema(raceType).parse(value)).toThrow(
                expectedMessage,
            );
        });
    });
});
