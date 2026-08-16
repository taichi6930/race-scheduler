/**
 * composeRaceId ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | raceType | dateTime(UTC)        | locationCode | raceNumber | 期待結果                   |
 * |---|----------|----------------------|--------------|------------|----------------------------|
 * | 1 | jra      | 2026-01-27T00:00:00Z | '06'         | 1          | 'jra202601270601'          |
 * | 2 | nar      | 2026-03-15T00:00:00Z | '15'         | 12         | 'nar202603151512'          |
 * | 3 | keirin   | 2026-06-01T00:00:00Z | '01'         | 5          | 'keirin2026060101_05'形式  |
 * | 4 | jra      | UTC前日(JST翌日)      | '05'         | 1          | JST翌日の日付を使用        |
 * | 5 | jra      | 2桁raceNumber        | '06'         | 11         | 0埋めなし                  |
 *
 * ## デシジョンテーブル（compose→decompose 往復一貫性, Q2-3）
 *
 * composeRaceId には対になる decomposeRaceId が存在しないため、raceId 末尾2桁の
 * raceNumber を除いた先頭部分が composePlaceId の出力と一致すること・その部分を
 * decomposePlaceId に通した結果が元の raceType/locationCode/JST日付と一致することを検証する。
 *
 * | #    | raceType | dateTime(UTC)          | locationCode | raceNumber | 期待JST日付(y-m-d) |
 * |------|----------|-------------------------|--------------|------------|---------------------|
 * | RT-1 | jra      | 2026-01-27T00:00:00Z    | '06'         | 1          | 2026-01-27           |
 * | RT-2 | nar      | 2026-03-15T00:00:00Z    | '15'         | 12         | 2026-03-15           |
 * | RT-3 | jra      | 2026-01-26T15:00:00Z（JST日付繰り上がり境界） | '05' | 9 | 2026-01-27 |
 */

import { describe, expect, it } from 'bun:test';

import type { LocationCode } from '../../../../../src/domain/model/valueObject/locationCode';
import { validateLocationCode } from '../../../../../src/domain/model/valueObject/locationCode';
import type { PlaceId } from '../../../../../src/domain/model/valueObject/placeId';
import { validatePlaceId } from '../../../../../src/domain/model/valueObject/placeId';
import type { RaceId } from '../../../../../src/domain/model/valueObject/raceId';
import { validateRaceId } from '../../../../../src/domain/model/valueObject/raceId';
import { RaceType } from '../../../../../src/domain/model/valueObject/raceType';
import { composePlaceId } from '../../../../../src/domain/service/identifier/composePlaceId';
import { composeRaceId } from '../../../../../src/domain/service/identifier/composeRaceId';
import { decomposePlaceId } from '../../../../../src/domain/service/identifier/decomposePlaceId';

/** テスト内の期待値をbrand付きRaceId型として扱うためのヘルパー */
const asRaceId = (value: string): RaceId => validateRaceId(value);

describe('composeRaceId', () => {
    describe('正常系: raceTypeごとのID生成', () => {
        it('ケース#1: JRA・raceNumber 1桁', () => {
            // Arrange
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-27T00:00:00Z');
            const locationCode = validateLocationCode('06');
            const raceNumber = 1;

            // Act
            const result = composeRaceId(
                raceType,
                dateTime,
                locationCode,
                raceNumber,
            );

            // Assert
            expect(result).toBe(asRaceId('jra202601270601'));
        });

        it('ケース#2: NAR・raceNumber 2桁', () => {
            // Arrange
            const raceType = RaceType.NAR;
            const dateTime = new Date('2026-03-15T00:00:00Z');
            const locationCode = validateLocationCode('15');
            const raceNumber = 12;

            // Act
            const result = composeRaceId(
                raceType,
                dateTime,
                locationCode,
                raceNumber,
            );

            // Assert
            expect(result).toBe(asRaceId('nar202603151512'));
        });

        it('ケース#3: KEIRIN', () => {
            // Arrange
            const raceType = RaceType.KEIRIN;
            const dateTime = new Date('2026-06-01T00:00:00Z');
            const locationCode = validateLocationCode('01');
            const raceNumber = 5;

            // Act
            const result = composeRaceId(
                raceType,
                dateTime,
                locationCode,
                raceNumber,
            );

            // Assert
            expect(result).toBe(asRaceId('keirin2026060101' + '05'));
        });
    });

    describe('正常系: JST変換の確認', () => {
        it('ケース#4: UTC 15:00 (JST 翌日 00:00) は翌日の日付になる', () => {
            // Arrange: UTC 2026-01-26T15:00:00Z = JST 2026-01-27T00:00:00+09:00
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-26T15:00:00Z');
            const locationCode = validateLocationCode('05');
            const raceNumber = 1;

            // Act
            const result = composeRaceId(
                raceType,
                dateTime,
                locationCode,
                raceNumber,
            );

            // Assert: JST 2026-01-27
            expect(result).toBe(asRaceId('jra202601270501'));
        });
    });

    describe('正常系: raceNumber のゼロ埋め', () => {
        it('raceNumber が 1桁のとき 0埋めされる', () => {
            // Arrange
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-27T00:00:00Z');
            const locationCode = validateLocationCode('06');
            const raceNumber = 1;

            // Act
            const result = composeRaceId(
                raceType,
                dateTime,
                locationCode,
                raceNumber,
            );

            // Assert: raceNumber部分が '01'
            expect(result.endsWith('01')).toBe(true);
        });

        it('ケース#5: raceNumber が 2桁のとき 0埋めされない', () => {
            // Arrange
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-27T00:00:00Z');
            const locationCode = validateLocationCode('06');
            const raceNumber = 11;

            // Act
            const result = composeRaceId(
                raceType,
                dateTime,
                locationCode,
                raceNumber,
            );

            // Assert: raceNumber部分が '11'
            expect(result).toBe(asRaceId('jra202601270611'));
        });
    });

    describe('正常系: locationCode のゼロ埋め', () => {
        it('locationCode が 1桁のとき 0埋めされる', () => {
            // Arrange
            // LocationCodeSchema は2桁の数字のみを許容するため、1桁の値は本来
            // validateLocationCode を通過できない。composePlaceId 内の padStart
            // （呼び出し側の契約違反に対する防御的な実装）を直接検証するため
            // ここでは意図的に型を迂回する。
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-27T00:00:00Z');
            const locationCode = '5' as unknown as LocationCode;
            const raceNumber = 3;

            // Act
            const result = composeRaceId(
                raceType,
                dateTime,
                locationCode,
                raceNumber,
            );

            // Assert: locationCode '5' → '05', raceNumber '3' → '03'
            expect(result).toBe(asRaceId('jra202601270503'));
        });
    });

    describe('正常系: IDフォーマット確認', () => {
        it('生成されたIDは raceType + yyyyMMdd + locationCode(2桁) + raceNumber(2桁) の形式', () => {
            // Arrange
            const raceType = RaceType.BOATRACE;
            const dateTime = new Date('2026-12-31T00:00:00Z');
            const locationCode = validateLocationCode('02');
            const raceNumber = 6;

            // Act
            const result = composeRaceId(
                raceType,
                dateTime,
                locationCode,
                raceNumber,
            );

            // Assert: 'boatrace' + '20261231' + '02' + '06' = 'boatrace2026123102' + '06'
            expect(result).toBe(asRaceId('boatrace2026123102' + '06'));
        });
    });

    describe('compose→decompose 往復一貫性（Q2-3、JST日付境界を含む）', () => {
        it.each([
            [
                'RT-1',
                RaceType.JRA,
                '2026-01-27T00:00:00Z',
                '06',
                1,
                2026,
                1,
                27,
            ],
            [
                'RT-2',
                RaceType.NAR,
                '2026-03-15T00:00:00Z',
                '15',
                12,
                2026,
                3,
                15,
            ],
            [
                'RT-3',
                RaceType.JRA,
                '2026-01-26T15:00:00Z',
                '05',
                9,
                2026,
                1,
                27,
            ],
        ])(
            '[%s] composeRaceId 内の placeId 部分が composePlaceId/decomposePlaceId と整合する',
            (_label, raceType, dateTimeIso, locationCodeStr, raceNumber, expectedYear, expectedMonth, expectedDay) => {
                // Arrange
                const dateTime = new Date(dateTimeIso);
                const locationCode = validateLocationCode(locationCodeStr);

                // Act
                const raceId = composeRaceId(
                    raceType,
                    dateTime,
                    locationCode,
                    raceNumber,
                );
                const expectedPlaceId = composePlaceId(
                    raceType,
                    dateTime,
                    locationCode,
                );
                // raceId 末尾の raceNumber(2桁)を除いた部分が placeId になる
                const embeddedPlaceIdStr = raceId.slice(0, -2);
                const embeddedPlaceId: PlaceId =
                    validatePlaceId(embeddedPlaceIdStr);
                const decomposed = decomposePlaceId(embeddedPlaceId);

                // Assert: raceId の先頭部分は composePlaceId の出力と一致する
                expect(embeddedPlaceId).toBe(expectedPlaceId);
                // Assert: decomposePlaceId で raceType/locationCode/JST日付を復元できる
                expect(decomposed.raceType).toBe(raceType);
                expect(decomposed.locationCode).toBe(locationCode);
                expect(decomposed.date.getFullYear()).toBe(expectedYear);
                expect(decomposed.date.getMonth() + 1).toBe(expectedMonth);
                expect(decomposed.date.getDate()).toBe(expectedDay);
                // Assert: raceNumber部分（末尾2桁）も正しくゼロ埋めされている
                expect(raceId.slice(-2)).toBe(
                    String(raceNumber).padStart(2, '0'),
                );
            },
        );
    });
});
