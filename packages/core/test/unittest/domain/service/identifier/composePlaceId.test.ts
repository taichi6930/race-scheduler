/**
 * composePlaceId ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | raceType  | dateTime(UTC)           | locationCode | 期待結果              |
 * |---|-----------|-------------------------|--------------|-----------------------|
 * | 1 | jra       | 2026-01-27T00:00:00Z    | '06'         | 'jra2026012706'       |
 * | 2 | nar       | 2026-03-15T00:00:00Z    | '15'         | 'nar2026031515'       |
 * | 3 | keirin    | 2026-06-01T00:00:00Z    | '01'         | 'keirin2026060101'    |
 * | 4 | jra       | 前日23:00UTC(JST翌日)   | '05'         | JST翌日の日付を使用   |
 * | 5 | jra       | locationCode '5'(1桁)  | '5'          | 0埋めで '05'になる    |
 *
 * ## デシジョンテーブル（compose→decompose 往復一貫性, Q2-3）
 *
 * | #    | raceType | dateTime(UTC)         | locationCode | 期待JST日付(y-m-d) |
 * |------|----------|------------------------|--------------|---------------------|
 * | RT-1 | jra      | 2026-01-27T00:00:00Z   | '06'         | 2026-01-27           |
 * | RT-2 | nar      | 2026-03-15T00:00:00Z   | '15'         | 2026-03-15           |
 * | RT-3 | keirin   | 2026-06-01T00:00:00Z   | '01'         | 2026-06-01           |
 * | RT-4 | jra      | 2026-01-26T15:00:00Z（JST日付繰り上がり境界） | '05' | 2026-01-27 |
 * | RT-5 | jra      | 2026-01-26T14:59:00Z（境界の1分前・繰り上がらない） | '06' | 2026-01-26 |
 * | RT-6 | jra      | 2025-12-31T15:01:00Z（年またぎ・JSTで翌年） | '01' | 2026-01-01 |
 * | RT-7 | jra      | 2025-12-31T14:59:00Z（年またぎ境界の1分前） | '02' | 2025-12-31 |
 */

import { describe, expect, it } from 'bun:test';

import type { LocationCode } from '../../../../../src/domain/model/valueObject/locationCode';
import { validateLocationCode } from '../../../../../src/domain/model/valueObject/locationCode';
import type { PlaceId } from '../../../../../src/domain/model/valueObject/placeId';
import { validatePlaceId } from '../../../../../src/domain/model/valueObject/placeId';
import { RaceType } from '../../../../../src/domain/model/valueObject/raceType';
import { composePlaceId } from '../../../../../src/domain/service/identifier/composePlaceId';
import { decomposePlaceId } from '../../../../../src/domain/service/identifier/decomposePlaceId';

/** テスト内の期待値をbrand付きPlaceId型として扱うためのヘルパー */
const asPlaceId = (value: string): PlaceId => validatePlaceId(value);

describe('composePlaceId', () => {
    describe('正常系: raceTypeごとのID生成', () => {
        it('ケース#1: JRA・locationCode 2桁', () => {
            // Arrange
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-27T00:00:00Z');
            const locationCode = validateLocationCode('06');

            // Act
            const result = composePlaceId(raceType, dateTime, locationCode);

            // Assert
            expect(result).toBe(asPlaceId('jra2026012706'));
        });

        it('ケース#2: NAR・locationCode 2桁', () => {
            // Arrange
            const raceType = RaceType.NAR;
            const dateTime = new Date('2026-03-15T00:00:00Z');
            const locationCode = validateLocationCode('15');

            // Act
            const result = composePlaceId(raceType, dateTime, locationCode);

            // Assert
            expect(result).toBe(asPlaceId('nar2026031515'));
        });

        it('ケース#3: KEIRIN', () => {
            // Arrange
            const raceType = RaceType.KEIRIN;
            const dateTime = new Date('2026-06-01T00:00:00Z');
            const locationCode = validateLocationCode('01');

            // Act
            const result = composePlaceId(raceType, dateTime, locationCode);

            // Assert
            expect(result).toBe(asPlaceId('keirin2026060101'));
        });
    });

    describe('正常系: JST変換の確認', () => {
        it('ケース#4: UTC 15:00 (JST 翌日 00:00) は翌日の日付になる', () => {
            // Arrange: UTC 2026-01-26T15:00:00Z = JST 2026-01-27T00:00:00+09:00
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-26T15:00:00Z');
            const locationCode = validateLocationCode('05');

            // Act
            const result = composePlaceId(raceType, dateTime, locationCode);

            // Assert: JST では 2026-01-27 なので date部分は '20260127'
            expect(result).toBe(asPlaceId('jra2026012705'));
        });

        it('UTC 前日23:59 (JST 当日08:59) は当日の日付になる', () => {
            // Arrange: UTC 2026-01-26T23:59:00Z = JST 2026-01-27T08:59:00+09:00
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-26T23:59:00Z');
            const locationCode = validateLocationCode('06');

            // Act
            const result = composePlaceId(raceType, dateTime, locationCode);

            // Assert: JST では 2026-01-27 なので date部分は '20260127'
            expect(result).toBe(asPlaceId('jra2026012706'));
        });
    });

    describe('正常系: locationCode のゼロ埋め', () => {
        it('ケース#5: locationCode が 1桁のとき 0埋めされる', () => {
            // Arrange
            // LocationCodeSchema は2桁の数字のみを許容するため、1桁の値は本来
            // validateLocationCode を通過できない。composePlaceId 内の padStart は
            // 呼び出し側の契約違反に対する防御的な実装であり、それを直接検証するため
            // ここでは意図的に型を迂回する。
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-27T00:00:00Z');
            const locationCode = '5' as unknown as LocationCode;

            // Act
            const result = composePlaceId(raceType, dateTime, locationCode);

            // Assert
            expect(result).toBe(asPlaceId('jra2026012705'));
        });

        it('locationCode が 2桁のとき 0埋めされない', () => {
            // Arrange
            const raceType = RaceType.JRA;
            const dateTime = new Date('2026-01-27T00:00:00Z');
            const locationCode = validateLocationCode('06');

            // Act
            const result = composePlaceId(raceType, dateTime, locationCode);

            // Assert
            expect(result).toBe(asPlaceId('jra2026012706'));
        });
    });

    describe('正常系: ID フォーマット確認', () => {
        it('生成されたIDは raceType + yyyyMMdd + locationCode(2桁) の形式', () => {
            // Arrange
            const raceType = RaceType.AUTORACE;
            const dateTime = new Date('2026-12-31T00:00:00Z');
            const locationCode = validateLocationCode('03');

            // Act
            const result = composePlaceId(raceType, dateTime, locationCode);

            // Assert: 'autorace' + '20261231' + '03' = 'autorace2026123103'
            expect(result).toBe(asPlaceId('autorace2026123103'));
            expect(result.startsWith('autorace')).toBe(true);
        });
    });

    describe('compose→decompose 往復一貫性（Q2-3、JST日付境界を含む）', () => {
        it.each([
            ['RT-1', RaceType.JRA, '2026-01-27T00:00:00Z', '06', 2026, 1, 27],
            ['RT-2', RaceType.NAR, '2026-03-15T00:00:00Z', '15', 2026, 3, 15],
            ['RT-3', RaceType.KEIRIN, '2026-06-01T00:00:00Z', '01', 2026, 6, 1],
            ['RT-4', RaceType.JRA, '2026-01-26T15:00:00Z', '05', 2026, 1, 27],
            ['RT-5', RaceType.JRA, '2026-01-26T14:59:00Z', '06', 2026, 1, 26],
            ['RT-6', RaceType.JRA, '2025-12-31T15:01:00Z', '01', 2026, 1, 1],
            ['RT-7', RaceType.JRA, '2025-12-31T14:59:00Z', '02', 2025, 12, 31],
        ])(
            '[%s] composePlaceId → decomposePlaceId が raceType/locationCode/JST日付を保持する',
            (_label, raceType, dateTimeIso, locationCodeStr, expectedYear, expectedMonth, expectedDay) => {
                // Arrange
                const dateTime = new Date(dateTimeIso);
                const locationCode = validateLocationCode(locationCodeStr);

                // Act
                const placeId = composePlaceId(
                    raceType,
                    dateTime,
                    locationCode,
                );
                const decomposed = decomposePlaceId(placeId);

                // Assert
                expect(decomposed.raceType).toBe(raceType);
                expect(decomposed.locationCode).toBe(locationCode);
                expect(decomposed.date.getFullYear()).toBe(expectedYear);
                expect(decomposed.date.getMonth() + 1).toBe(expectedMonth);
                expect(decomposed.date.getDate()).toBe(expectedDay);
            },
        );
    });
});
