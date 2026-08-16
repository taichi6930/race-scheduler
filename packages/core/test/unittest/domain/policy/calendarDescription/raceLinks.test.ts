/**
 * buildRaceLinks のユニットテスト
 *
 * ## デシジョンテーブル
 * | # | raceType | 期待 |
 * |---|----------|------|
 * | T-01 | JRA | buildJraRaceLinksの結果（非空配列） |
 * | T-02 | NAR | buildNarRaceLinksの結果（非空配列） |
 * | T-03 | KEIRIN | buildKeirinRaceLinksの結果（非空配列） |
 * | T-04 | AUTORACE | 空配列 |
 * | T-05 | BOATRACE | 空配列 |
 * | T-06 | OVERSEAS | 空配列 |
 */

import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';

import { buildRaceLinks } from '../../../../../src/domain/policy/calendarDescription/raceLinks';

const JRA_ENTITY: RaceEntity = {
    raceId: validateRaceId('jra202501010501'),
    placeId: validatePlaceId('jra2025010105'),
    raceType: RaceType.JRA,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: '有馬記念',
    raceNumber: 1,
    raceCourse: '東京',
    locationCode: validateLocationCode('05'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2000 },
    placeHeldDays: { heldTimes: 3, heldDayTimes: 1 },
};

const NAR_ENTITY: RaceEntity = {
    raceId: validateRaceId('nar202501012001'),
    placeId: validatePlaceId('nar2025010120'),
    raceType: RaceType.NAR,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: 'NARレース',
    raceNumber: 1,
    raceCourse: '大井',
    locationCode: validateLocationCode('20'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: 'ダート', distance: 1600 },
};

const KEIRIN_ENTITY: RaceEntity = {
    raceId: validateRaceId('keirin202501011101'),
    placeId: validatePlaceId('keirin2025010111'),
    raceType: RaceType.KEIRIN,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: 'ケイリンレース',
    raceNumber: 1,
    raceCourse: '函館',
    locationCode: validateLocationCode('11'),
    raceGrade: 'GⅠ',
    raceStage: 'S級決勝',
};

const AUTORACE_ENTITY: RaceEntity = {
    raceId: validateRaceId('autorace202501010101'),
    placeId: validatePlaceId('autorace2025010101'),
    raceType: RaceType.AUTORACE,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: 'オートレース',
    raceNumber: 1,
    raceCourse: '飯塚',
    locationCode: validateLocationCode('01'),
    raceGrade: 'SG',
    raceStage: '優勝戦',
};

const BOATRACE_ENTITY: RaceEntity = {
    raceId: validateRaceId('boatrace202501010101'),
    placeId: validatePlaceId('boatrace2025010101'),
    raceType: RaceType.BOATRACE,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: 'ボートレース',
    raceNumber: 1,
    raceCourse: '桐生',
    locationCode: validateLocationCode('01'),
    raceGrade: 'SG',
    raceStage: '優勝戦',
};

const OVERSEAS_ENTITY: RaceEntity = {
    raceId: validateRaceId('overseas202501010101'),
    placeId: validatePlaceId('overseas2025010101'),
    raceType: RaceType.OVERSEAS,
    datetime: new Date('2025-01-01T09:00:00+09:00'),
    raceName: '海外レース',
    raceNumber: 1,
    raceCourse: 'ロンシャン',
    locationCode: validateLocationCode('01'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2400 },
};

describe('buildRaceLinks', () => {
    it('[T-01] JRA_buildJraRaceLinksの結果を返す', () => {
        const result = buildRaceLinks(JRA_ENTITY);

        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toEqual(
            expect.objectContaining({
                label: expect.any(String),
                url: expect.any(String),
            }),
        );
    });

    it('[T-02] NAR_buildNarRaceLinksの結果を返す', () => {
        const result = buildRaceLinks(NAR_ENTITY);

        expect(result.length).toBeGreaterThan(0);
    });

    it('[T-03] KEIRIN_buildKeirinRaceLinksの結果を返す', () => {
        const result = buildRaceLinks(KEIRIN_ENTITY);

        expect(result.length).toBeGreaterThan(0);
    });

    it('[T-04] AUTORACE_空配列を返す', () => {
        const result = buildRaceLinks(AUTORACE_ENTITY);

        expect(result).toEqual([]);
    });

    it('[T-05] BOATRACE_空配列を返す', () => {
        const result = buildRaceLinks(BOATRACE_ENTITY);

        expect(result).toEqual([]);
    });

    it('[T-06] OVERSEAS_空配列を返す', () => {
        const result = buildRaceLinks(OVERSEAS_ENTITY);

        expect(result).toEqual([]);
    });
});
