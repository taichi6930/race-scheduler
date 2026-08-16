/**
 * raceMapper.test.ts - RaceMapper ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: RaceMapper.toEntity()
 * | ケース | 入力 | 期待値 | 備考 |
 * |--------|------|--------|------|
 * | R1 | placeName・conditionData・placeHeldDays ありの有効な JRA 行 | RaceEntity | 全フィールドマッピング |
 * | R2 | place_name なしの有効な JRA 行 | RaceEntity | findPlaceNameByCode にフォールバック |
 * | R3 | race_stage ありの有効な KEIRIN 行 | raceStage を持つ RaceEntity | 機械い レース |
 * | R4 | conditionData なしの有効な NAR 行 | RaceEntity（conditionData は undefined）| オプショナル |
 * | R5 | held_times が null の行 | RaceEntity（placeHeldDays は undefined）| オプショナル |
 * | R6 | 無効な race_type の行 | Error | バリデーション失敗 |
 * | R7 | 必須フィールド欠如の行 | Error | バリデーション失敗 |
 * | R9 | is_confirmed が 0 の行 | isConfirmed: false | 明示的に未確定 |
 * | R10 | is_confirmed が欠如した行 | isConfirmed: true | 既存行との後方互換 |
 * | R11 | race_stage が無い行（JRA） | raceStageConfirmed: undefined | 非機械式は対象外 |
 * | R12 | race_stage ありでrace_stage_confirmedが欠如した行 | raceStageConfirmed: true | 既存行との後方互換 |
 * | R13 | race_stage ありでrace_stage_confirmedが0の行 | raceStageConfirmed: false | マスタ未一致の仮登録 |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import { validatePlaceId, validateRaceId } from '@race-schedule/core';
import { RaceMapper } from '../../../../src/repository/implement/raceMapper';

describe('RaceMapper.toEntity', () => {
    // R1: placeName・conditionData・placeHeldDays を持つ有効な JRA 行
    it('R1: 全フィールドを持つ有効なJRA行をRaceEntityにマッピングする', () => {
        const row = {
            raceId: 'jra202501010501',
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            placeName: '東京',
            raceName: '有馬記念',
            grade: 'GⅠ',
            raceNumber: 1,
            distance: 2000,
            surfaceType: '芝',
            heldTimes: 3,
            heldDayTimes: 1,
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.raceId).toBe(validateRaceId('jra202501010501'));
        expect(entity.placeId).toBe(validatePlaceId('jra2025010105'));
        expect(entity.raceType).toBe('jra');
        expect(entity.raceCourse).toBe('東京');
        expect(entity.raceGrade).toBe('GⅠ');
        expect(entity.raceNumber).toBe(1);
        expect(entity.conditionData).toEqual({
            surfaceType: '芝',
            distance: 2000,
        });
        expect(entity.placeHeldDays).toEqual({ heldTimes: 3, heldDayTimes: 1 });
    });

    // R2: Valid JRA row without place_name → falls back to findPlaceNameByCode
    it('R2: placeNameなしJRA行をfindPlaceNameByCodeフォールバックでマッピングする', () => {
        const row = {
            raceId: 'jra202501010501',
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            // place_name is absent → falls back to findPlaceNameByCode
            raceName: '有馬記念',
            grade: 'GⅠ',
            raceNumber: 1,
            distance: 2000,
            surfaceType: '芝',
            heldTimes: null,
            heldDayTimes: null,
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.raceId).toBe(validateRaceId('jra202501010501'));
        // findPlaceNameByCode('jra', '05') は東京競馬場を返す（courseOfficialMaster/jra.ts参照）
        expect(entity.raceCourse).toBe('東京');
    });

    // R3: race_stage を持つ有効な KEIRIN 行
    it('R3: raceStage付き有効なKEIRIN行をマッピングする', () => {
        const row = {
            raceId: 'keirin202501011101',
            placeId: 'keirin2025010111',
            raceType: 'keirin',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '11',
            placeName: '函館',
            raceName: 'ケイリンレース',
            grade: 'GⅠ',
            raceNumber: 1,
            raceStage: 'S級決勝',
            heldTimes: null,
            heldDayTimes: null,
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.raceId).toBe(validateRaceId('keirin202501011101'));
        expect(entity.raceType).toBe('keirin');
        expect(entity.raceStage).toBe('S級決勝');
        expect(entity.conditionData).toBeUndefined();
    });

    // R4: conditionData を持つ有効な NAR 行
    it('R4: conditionData付きNAR行をマッピングする', () => {
        const row = {
            raceId: 'nar202501012001',
            placeId: 'nar2025010120',
            raceType: 'nar',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '20',
            placeName: '大井',
            raceName: 'NARレース',
            grade: 'GⅠ',
            raceNumber: 1,
            distance: 1600,
            surfaceType: 'ダート',
            heldTimes: null,
            heldDayTimes: null,
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.raceType).toBe('nar');
        expect(entity.conditionData).toEqual({
            surfaceType: 'ダート',
            distance: 1600,
        });
        expect(entity.placeHeldDays).toBeUndefined();
    });

    // R4b: conditionData なしの KEIRIN 行 → conditionData は undefined（機械いレース）
    it('R4b: BOATRACE（機械レース）ではconditionDataがundefinedになる', () => {
        const row = {
            raceId: 'boatrace202501010101',
            placeId: 'boatrace2025010101',
            raceType: 'boatrace',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '01',
            placeName: '桐生',
            raceName: 'ボートレース',
            grade: 'SG',
            raceNumber: 1,
            raceStage: '優勝戦',
            heldTimes: null,
            heldDayTimes: null,
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.raceType).toBe('boatrace');
        expect(entity.conditionData).toBeUndefined();
    });

    // R5: held_times が null の行 → placeHeldDays は undefined
    it('R5: heldTimesがnullのときplaceHeldDaysをundefinedにする', () => {
        const row = {
            raceId: 'jra202501010501',
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            placeName: '東京',
            raceName: '有馬記念',
            grade: 'GⅠ',
            raceNumber: 1,
            distance: 2000,
            surfaceType: '芝',
            heldTimes: null,
            heldDayTimes: null,
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.placeHeldDays).toBeUndefined();
    });

    // R6: 無効な race_type の行 → Error をスロー
    it('R6: raceTypeが不正なときErrorをスローする', () => {
        const row = {
            raceId: 'invalid202501010501',
            placeId: 'invalid2025010105',
            raceType: 'invalid_type',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            placeName: '東京',
            raceName: 'テストレース',
            grade: 'GⅠ',
            raceNumber: 1,
        };

        expect(() => RaceMapper.toEntity(row)).toThrow();
    });

    // R7: 空の race_name の行（RaceNameSchema min(1) 失敗）→ Error をスロー
    it('R7: 必須フィールドの検証失敗時にErrorをスローする', () => {
        const row = {
            raceId: 'jra202501010501',
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            placeName: '東京',
            raceName: '',
            grade: 'GⅠ',
            raceNumber: 1,
            distance: 2000,
            surfaceType: '芝',
        };

        expect(() => RaceMapper.toEntity(row)).toThrow();
    });

    // R8: raceNumber が欠如した行 → raceRowSchema（行検証）でErrorをスローする
    it('R8: raceNumberが欠如した行は行検証(raceRowSchema)でErrorをスローする', () => {
        const row = {
            raceId: 'jra202501010501',
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            raceName: '有馬記念',
            grade: 'GⅠ',
            // raceNumber が欠如
        };

        expect(() => RaceMapper.toEntity(row)).toThrow(
            'Invalid race data from gateway',
        );
    });

    // R9: is_confirmed が 0 の行 → isConfirmed: false
    it('R9: isConfirmedが0のとき明示的にfalseへマッピングする', () => {
        const row = {
            raceId: 'jra202501010501',
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            placeName: '東京',
            raceName: '有馬記念',
            grade: 'GⅠ',
            raceNumber: 1,
            distance: 2000,
            surfaceType: '芝',
            isConfirmed: 0,
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.isConfirmed).toBe(false);
    });

    // R10: is_confirmed が欠如した行 → isConfirmed: true（既存行との後方互換）
    it('R10: isConfirmedが欠如したときtrueへフォールバックする', () => {
        const row = {
            raceId: 'jra202501010501',
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            placeName: '東京',
            raceName: '有馬記念',
            grade: 'GⅠ',
            raceNumber: 1,
            distance: 2000,
            surfaceType: '芝',
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.isConfirmed).toBe(true);
    });

    // R11: race_stage が無い行（JRA） → raceStageConfirmed は undefined（非機械式は対象外）
    it('R11: raceStageが無い行はraceStageConfirmedをundefinedにする', () => {
        const row = {
            raceId: 'jra202501010501',
            placeId: 'jra2025010105',
            raceType: 'jra',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '05',
            placeName: '東京',
            raceName: '有馬記念',
            grade: 'GⅠ',
            raceNumber: 1,
            distance: 2000,
            surfaceType: '芝',
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.raceStageConfirmed).toBeUndefined();
    });

    // R12: race_stage ありでrace_stage_confirmed列が欠如した行 → true（既存行との後方互換）
    it('R12: raceStageありでraceStageConfirmedが欠如したときtrueへフォールバックする', () => {
        const row = {
            raceId: 'keirin202501011101',
            placeId: 'keirin2025010111',
            raceType: 'keirin',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '11',
            placeName: '函館',
            raceName: 'ケイリンレース',
            grade: 'GⅠ',
            raceNumber: 1,
            raceStage: 'S級決勝',
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.raceStageConfirmed).toBe(true);
    });

    // R13: race_stage ありでrace_stage_confirmedが0の行 → false（マスタ未一致の仮登録）
    it('R13: raceStageConfirmedが0のとき明示的にfalseへマッピングする', () => {
        const row = {
            raceId: 'keirin202501011101',
            placeId: 'keirin2025010111',
            raceType: 'keirin',
            dateTime: '2025-01-01T09:00:00+09:00',
            locationCode: '11',
            placeName: '函館',
            raceName: 'ケイリンレース',
            grade: 'GⅠ',
            raceNumber: 1,
            raceStage: '謎ステージ',
            raceStageConfirmed: 0,
        };

        const entity = RaceMapper.toEntity(row);

        expect(entity.raceStageConfirmed).toBe(false);
    });
});
