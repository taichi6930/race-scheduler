/**
 * domain/policy/raceDetailUi/fieldCatalog テスト
 *
 * ## デシジョンテーブル: RACE_DETAIL_FIELDS の各フィールドresolve
 *
 * | #    | フィールド | 入力                                        | 期待結果            |
 * |------|-----------|---------------------------------------------|---------------------|
 * | T-01 | time      | KEIRIN, 09:05                                | "09:05"             |
 * | T-02 | time      | OVERSEAS, 09:05                              | "09:05（JST）"      |
 * | T-03 | raceType  | KEIRIN                                       | "競輪"              |
 * | T-04 | course    | raceCourse: "和歌山"                          | "和歌山"            |
 * | T-05 | number    | raceNumber: 10                               | "10R"               |
 * | T-06 | grade     | raceGrade: "GⅢ"                              | "GⅢ"                |
 * | T-07 | grade     | raceGrade: ""（空文字）                       | null                |
 * | T-08 | stage     | raceStage: "S級準決勝"                        | "S級準決勝"          |
 * | T-09 | stage     | raceStage未設定                               | null                |
 * | T-10 | condition | conditionData: {surfaceType:"芝",distance:2000} | "芝 ・ 2000m"     |
 * | T-11 | condition | conditionData未設定                           | null                |
 */

import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';

import { RACE_DETAIL_FIELDS } from '../../../../../src/domain/policy/raceDetailUi/fieldCatalog';

const BASE_ENTITY: RaceEntity = {
    raceId: validateRaceId('keirin202608023601'),
    placeId: validatePlaceId('keirin2026080236'),
    raceType: RaceType.KEIRIN,
    datetime: new Date('2026-08-02T09:05:00+09:00'),
    raceName: 'S級準決勝',
    raceNumber: 10,
    raceCourse: '和歌山',
    locationCode: validateLocationCode('36'),
    raceGrade: 'GⅢ',
    raceStage: 'S級準決勝',
};

describe('RACE_DETAIL_FIELDS', () => {
    it('T-01: timeはKEIRINならJST表記無しのHH:mmを返すこと', () => {
        expect(RACE_DETAIL_FIELDS.time.resolve(BASE_ENTITY)).toBe('09:05');
    });

    it('T-02: timeはOVERSEASなら（JST）付きのHH:mmを返すこと', () => {
        const overseasEntity: RaceEntity = {
            ...BASE_ENTITY,
            raceType: RaceType.OVERSEAS,
            raceStage: undefined,
        };
        expect(RACE_DETAIL_FIELDS.time.resolve(overseasEntity)).toBe(
            '09:05（JST）',
        );
    });

    it('T-03: raceTypeはKEIRINなら「競輪」を返すこと', () => {
        expect(RACE_DETAIL_FIELDS.raceType.resolve(BASE_ENTITY)).toBe('競輪');
    });

    it('T-04: courseはraceCourseをそのまま返すこと', () => {
        expect(RACE_DETAIL_FIELDS.course.resolve(BASE_ENTITY)).toBe('和歌山');
    });

    it('T-05: numberは"{raceNumber}R"形式を返すこと', () => {
        expect(RACE_DETAIL_FIELDS.number.resolve(BASE_ENTITY)).toBe('10R');
    });

    it('T-06: gradeは値がある場合そのまま返すこと', () => {
        expect(RACE_DETAIL_FIELDS.grade.resolve(BASE_ENTITY)).toBe('GⅢ');
    });

    it('T-07: gradeは空文字の場合nullを返すこと', () => {
        const noGradeEntity: RaceEntity = { ...BASE_ENTITY, raceGrade: '' };
        expect(RACE_DETAIL_FIELDS.grade.resolve(noGradeEntity)).toBeNull();
    });

    it('T-08: stageは値がある場合そのまま返すこと', () => {
        expect(RACE_DETAIL_FIELDS.stage.resolve(BASE_ENTITY)).toBe('S級準決勝');
    });

    it('T-09: stageは未設定の場合nullを返すこと', () => {
        const noStageEntity: RaceEntity = {
            ...BASE_ENTITY,
            raceStage: undefined,
        };
        expect(RACE_DETAIL_FIELDS.stage.resolve(noStageEntity)).toBeNull();
    });

    it('T-10: conditionはconditionDataがある場合「馬場 ・ 距離m」を返すこと', () => {
        const jraEntity: RaceEntity = {
            ...BASE_ENTITY,
            raceType: RaceType.JRA,
            raceStage: undefined,
            conditionData: { surfaceType: '芝', distance: 2000 },
        };
        expect(RACE_DETAIL_FIELDS.condition.resolve(jraEntity)).toBe(
            '芝 ・ 2000m',
        );
    });

    it('T-11: conditionはconditionDataが無い場合nullを返すこと', () => {
        expect(RACE_DETAIL_FIELDS.condition.resolve(BASE_ENTITY)).toBeNull();
    });
});
