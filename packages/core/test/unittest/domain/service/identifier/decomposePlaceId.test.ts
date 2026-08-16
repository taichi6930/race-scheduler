/**
 * decomposePlaceId のテスト
 *
 * ## デシジョンテーブル
 *
 * decomposePlaceId は分岐を持たない単純な文字列分解（raceType/日付/locationCode の
 * スライス）のため、C0/C1 は代表的な入力を1件通せば満たされる。以下は仕様の
 * 網羅性を示すための代表ケース。
 *
 * | #    | raceType | 日付        | locationCode | 期待結果                        |
 * |------|----------|-------------|--------------|----------------------------------|
 * | T-01 | jra      | 2026-01-01  | 01           | JRA・年初・locationCode最小相当 |
 * | T-02 | nar      | 2026-02-02  | 15           | NAR                              |
 * | T-03 | keirin   | 2026-03-05  | 99           | KEIRIN・locationCode最大         |
 * | T-04 | autorace | 2026-04-10  | 30           | AUTORACE                         |
 * | T-05 | boatrace | 2026-05-15  | 45           | BOATRACE                         |
 * | T-06 | overseas | 2026-06-20  | 03           | OVERSEAS                         |
 * | T-07 | jra      | 2026-12-31  | 99           | 年末日                           |
 * | T-08 | jra      | 2024-02-29  | 01           | 閏年2月29日                      |
 * | T-09 | jra      | 2026-01-01  | 00           | locationCode最小値(00)           |
 * | T-10 | jra      | 2020-01-01  | 01           | 年度=2020                        |
 * | T-11 | jra      | 2030-01-01  | 01           | 年度=2030                        |
 *
 * ## デシジョンテーブル（decompose→compose 往復一貫性, Q2-3）
 *
 * | #     | placeId              | 期待（recomposeで元のplaceIdに戻る） |
 * |-------|-----------------------|----------------------------------------|
 * | RT-01 | jra2026010101         | 年始・locationCode最小相当              |
 * | RT-02 | nar2026020215         | NAR                                     |
 * | RT-03 | keirin2026030599      | locationCode最大(99)                    |
 * | RT-04 | autorace2026041030    | AUTORACE                                |
 * | RT-05 | boatrace2026051545    | BOATRACE                                |
 * | RT-06 | overseas2026062003    | OVERSEAS                                |
 * | RT-07 | jra2026123199         | 年末日                                  |
 * | RT-08 | jra2024022901         | 閏年2月29日                             |
 */
import { describe, expect, it } from 'bun:test';

import { validateLocationCode } from '../../../../../src/domain/model/valueObject/locationCode';
import type { PlaceId } from '../../../../../src/domain/model/valueObject/placeId';
import { validatePlaceId } from '../../../../../src/domain/model/valueObject/placeId';
import { RaceType } from '../../../../../src/domain/model/valueObject/raceType';
import { composePlaceId } from '../../../../../src/domain/service/identifier/composePlaceId';
import { decomposePlaceId } from '../../../../../src/domain/service/identifier/decomposePlaceId';

describe('decomposePlaceId', () => {
    it.each([
        [
            '[T-01] jra2026010101 は raceType=jra, date=2026-01-01, locationCode=01 に分解される',
            'jra2026010101',
            RaceType.JRA,
            new Date(2026, 0, 1),
            '01',
        ],
        [
            '[T-02] nar2026020215 は raceType=nar, date=2026-02-02, locationCode=15 に分解される',
            'nar2026020215',
            RaceType.NAR,
            new Date(2026, 1, 2),
            '15',
        ],
        [
            '[T-03] keirin2026030599 は raceType=keirin, date=2026-03-05, locationCode=99(最大) に分解される',
            'keirin2026030599',
            RaceType.KEIRIN,
            new Date(2026, 2, 5),
            '99',
        ],
        [
            '[T-04] autorace2026041030 は raceType=autorace, date=2026-04-10, locationCode=30 に分解される',
            'autorace2026041030',
            RaceType.AUTORACE,
            new Date(2026, 3, 10),
            '30',
        ],
        [
            '[T-05] boatrace2026051545 は raceType=boatrace, date=2026-05-15, locationCode=45 に分解される',
            'boatrace2026051545',
            RaceType.BOATRACE,
            new Date(2026, 4, 15),
            '45',
        ],
        [
            '[T-06] overseas2026062003 は raceType=overseas, date=2026-06-20, locationCode=03 に分解される',
            'overseas2026062003',
            RaceType.OVERSEAS,
            new Date(2026, 5, 20),
            '03',
        ],
        [
            '[T-07] jra2026123199 は年末日(2026-12-31)として分解される',
            'jra2026123199',
            RaceType.JRA,
            new Date(2026, 11, 31),
            '99',
        ],
        [
            '[T-08] jra2024022901 は閏年2月29日として分解される',
            'jra2024022901',
            RaceType.JRA,
            new Date(2024, 1, 29),
            '01',
        ],
        [
            '[T-09] jra2026010100 は locationCode最小値(00)として分解される',
            'jra2026010100',
            RaceType.JRA,
            new Date(2026, 0, 1),
            '00',
        ],
        [
            '[T-10] jra2020010101 は年度2020として分解される',
            'jra2020010101',
            RaceType.JRA,
            new Date(2020, 0, 1),
            '01',
        ],
        [
            '[T-11] jra2030010101 は年度2030として分解される',
            'jra2030010101',
            RaceType.JRA,
            new Date(2030, 0, 1),
            '01',
        ],
    ])(
        '%s',
        (_title, input, expectedRaceType, expectedDate, expectedLocationCode) => {
            const result = decomposePlaceId(validatePlaceId(input));

            expect(result.raceType).toBe(expectedRaceType);
            expect(result.date).toEqual(expectedDate);
            expect(result.locationCode).toBe(
                validateLocationCode(expectedLocationCode),
            );
        },
    );

    describe('decompose→compose 往復一貫性（Q2-3）', () => {
        it.each([
            ['RT-01', 'jra2026010101'],
            ['RT-02', 'nar2026020215'],
            ['RT-03', 'keirin2026030599'],
            ['RT-04', 'autorace2026041030'],
            ['RT-05', 'boatrace2026051545'],
            ['RT-06', 'overseas2026062003'],
            ['RT-07', 'jra2026123199'],
            ['RT-08', 'jra2024022901'],
        ])(
            '[%s] decomposePlaceId → composePlaceId が元の placeId 文字列に戻る',
            (_label, placeIdStr) => {
                // Arrange
                const originalPlaceId = validatePlaceId(placeIdStr);

                // Act
                const decomposed = decomposePlaceId(originalPlaceId);
                const recomposed: PlaceId = composePlaceId(
                    decomposed.raceType,
                    decomposed.date,
                    decomposed.locationCode,
                );

                // Assert
                expect(recomposed).toBe(originalPlaceId);
            },
        );
    });
});
