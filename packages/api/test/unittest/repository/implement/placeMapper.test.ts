/**
 * placeMapper.test.ts - PlaceMapper ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: PlaceMapper.toEntity()
 * | ケース | 入力 | 期待値 | 備考 |
 * |--------|------|--------|------|
 * | M1 | held_times/held_day_times ありの有効な JRA 行 | PlaceEntity | placeName解決、placeHeldDaysあり |
 * | M2 | 非機械式（JRA）行、includePlaceGrade省略 | placeGrade なし | 非機械式はplaceGrade対象外 |
 * | M3 | 機械式（KEIRIN）行、includePlaceGrade=true | placeGrade あり | 機械式かつ指定ありで含める |
 * | M4 | held_times が null の JRA 行 | placeHeldDays={heldTimes:1,heldDayTimes:1} | JRAはデフォルト値 |
 * | M4b | held_times が null の NAR 行 | placeHeldDays は undefined | JRA以外はデフォルトなし |
 * | M5 | includePlaceGrade=true だが place_grade が null の機械式行 | Error | 機械式はplaceGrade必須のためスキーマ検証で失敗 |
 * | M6 | includePlaceGrade=false の機械式行（placeGradeあり） | Error | 除外された結果placeGradeが未設定になりスキーマ検証で失敗 |
 * | M7 | isRaceListAvailable=1 | isRaceListAvailable=true | 1 → true 変換 |
 * | M8 | isRaceListAvailable=0 | isRaceListAvailable=false | 0 → false 変換 |
 * | M9 | is_race_list_available が null | isRaceListAvailable プロパティなし | 非該当は付与しない |
 * | M10 | 無効な race_type の行 | Error | validateRaceType失敗 |
 * | M11 | 必須フィールド欠如（date_time不正） | Error | PlaceEntitySchema検証失敗 |
 * | M12 | 必須フィールド欠如（place_id無し） | Error | placeRowSchema検証失敗（行検証） |
 * | M13 | location_code='05'のJRA行 | raceCourse='東京' | findPlaceNameByCodeで解決できる |
 * | M14 | 未知のlocation_code（'99'）のJRA行 | Error | findPlaceNameByCodeが解決できずraceCourse='99'にフォールバックするが、PlaceEntitySchemaのraceCourseSuperRefine（raceTypeごとの開催場名検証）で弾かれるためErrorになる |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import { validatePlaceId } from '@race-schedule/core';

import { PlaceMapper } from '../../../../src/repository/implement/placeMapper';

describe('PlaceMapper.toEntity', () => {
    it('M1: heldTimes付きの有効なJRA行をPlaceEntityにマッピングする', () => {
        const row = {
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            heldTimes: 3,
            heldDayTimes: 1,
        };

        const entity = PlaceMapper.toEntity(row);

        expect(entity.placeId).toBe(validatePlaceId('jra2025010105'));
        expect(entity.raceType).toBe('jra');
        expect(entity.placeHeldDays).toEqual({
            heldTimes: 3,
            heldDayTimes: 1,
        });
    });

    it('M2: 非機械式（JRA）行はincludePlaceGrade省略時にplaceGradeを含めない', () => {
        const row = {
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            heldTimes: 3,
            heldDayTimes: 1,
        };

        const entity = PlaceMapper.toEntity(row);

        expect(entity).not.toHaveProperty('placeGrade');
    });

    it('M3: 機械式（KEIRIN）行はincludePlaceGrade=trueでplaceGradeを含める', () => {
        const row = {
            placeId: 'keirin2025010143',
            raceType: 'keirin',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '43',
            placeGrade: 'GⅠ',
            heldTimes: null,
            heldDayTimes: null,
        };

        const entity = PlaceMapper.toEntity(row, { includePlaceGrade: true });

        expect(entity.placeGrade).toBe('GⅠ');
    });

    it('M4: heldTimesがnullのJRA行はデフォルトplaceHeldDaysを使う', () => {
        const row = {
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            heldTimes: null,
            heldDayTimes: null,
        };

        const entity = PlaceMapper.toEntity(row);

        expect(entity.placeHeldDays).toEqual({
            heldTimes: 1,
            heldDayTimes: 1,
        });
    });

    it('M4b: heldTimesがnullのNAR行はplaceHeldDaysがundefinedになる', () => {
        const row = {
            placeId: 'nar2025010120',
            raceType: 'nar',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '20',
            heldTimes: null,
            heldDayTimes: null,
        };

        const entity = PlaceMapper.toEntity(row);

        expect(entity.placeHeldDays).toBeUndefined();
    });

    it('M5: includePlaceGrade=trueでもplaceGradeがnullの機械式行はスキーマ検証でErrorをスローする', () => {
        const row = {
            placeId: 'keirin2025010143',
            raceType: 'keirin',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '43',
            placeGrade: null,
            heldTimes: null,
            heldDayTimes: null,
        };

        // 機械式（KEIRIN）はplaceGradeが必須のため、placeGradeがnullで
        // 除外された結果、PlaceEntitySchemaの検証で失敗する
        expect(() =>
            PlaceMapper.toEntity(row, { includePlaceGrade: true }),
        ).toThrow('placeGrade is required');
    });

    it('M6: includePlaceGrade=falseの機械式行（placeGradeあり）はスキーマ検証でErrorをスローする', () => {
        const row = {
            placeId: 'keirin2025010143',
            raceType: 'keirin',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '43',
            placeGrade: 'GⅠ',
            heldTimes: null,
            heldDayTimes: null,
        };

        // includePlaceGrade=falseによりplaceGradeが除外され、機械式では
        // 必須のためPlaceEntitySchemaの検証で失敗する
        expect(() =>
            PlaceMapper.toEntity(row, { includePlaceGrade: false }),
        ).toThrow('placeGrade is required');
    });

    it('M7: isRaceListAvailable=1のときisRaceListAvailable=trueにマッピングする', () => {
        const row = {
            placeId: 'nar2026071420',
            raceType: 'nar',
            dateTime: '2026-07-14T00:00:00+09:00',
            locationCode: '20',
            heldTimes: null,
            heldDayTimes: null,
            isRaceListAvailable: 1,
        };

        const entity = PlaceMapper.toEntity(row);

        expect(entity.isRaceListAvailable).toBe(true);
    });

    it('M8: isRaceListAvailable=0のときisRaceListAvailable=falseにマッピングする', () => {
        const row = {
            placeId: 'nar2026072020',
            raceType: 'nar',
            dateTime: '2026-07-20T00:00:00+09:00',
            locationCode: '20',
            heldTimes: null,
            heldDayTimes: null,
            isRaceListAvailable: 0,
        };

        const entity = PlaceMapper.toEntity(row);

        expect(entity.isRaceListAvailable).toBe(false);
    });

    it('M9: isRaceListAvailableがnullのときisRaceListAvailableを付与しない', () => {
        const row = {
            placeId: 'nar2026072120',
            raceType: 'nar',
            dateTime: '2026-07-21T00:00:00+09:00',
            locationCode: '20',
            heldTimes: null,
            heldDayTimes: null,
            isRaceListAvailable: null,
        };

        const entity = PlaceMapper.toEntity(row);

        expect(entity).not.toHaveProperty('isRaceListAvailable');
    });

    it('M10: raceTypeが不正なときErrorをスローする', () => {
        const row = {
            placeId: 'invalid2025010105',
            raceType: 'invalid_type',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
        };

        expect(() => PlaceMapper.toEntity(row)).toThrow();
    });

    it('M11: dateTimeが不正なときErrorをスローする', () => {
        const row = {
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: 'not-a-valid-date',
            locationCode: '05',
            heldTimes: 3,
            heldDayTimes: 1,
        };

        expect(() => PlaceMapper.toEntity(row)).toThrow(
            'Invalid place data from gateway',
        );
    });

    it('M12: placeIdが欠如した行は行検証(placeRowSchema)でErrorをスローする', () => {
        const row = {
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
        };

        expect(() => PlaceMapper.toEntity(row)).toThrow(
            'Invalid place data from gateway',
        );
    });

    it("M13: location_code='05'のJRA行はfindPlaceNameByCodeでraceCourse='東京'に解決される", () => {
        const row = {
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            heldTimes: 3,
            heldDayTimes: 1,
        };

        const entity = PlaceMapper.toEntity(row);

        expect(entity.raceCourse).toBe('東京');
    });

    it("M14: 未知のlocation_code（'99'）のJRA行はraceCourseが生コードにフォールバックした後スキーマ検証でErrorをスローする", () => {
        // findPlaceNameByCode('99', jra) は該当マスタが無くnullを返すため、
        // PlaceMapper内部ではraceCourseが生コード'99'にフォールバックする（?? String(...)の右辺）。
        // ただしPlaceEntitySchemaのraceCourseSuperRefineがraceTypeごとの既知の開催場名で
        // なければ拒否するため、フォールバック値では最終的に検証エラーとなる。
        const row = {
            placeId: 'jra2025010199',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '99',
            heldTimes: 3,
            heldDayTimes: 1,
        };

        expect(() => PlaceMapper.toEntity(row)).toThrow(
            'Invalid place data from gateway',
        );
    });
});
