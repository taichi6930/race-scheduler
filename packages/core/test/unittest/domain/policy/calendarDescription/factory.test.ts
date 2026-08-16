import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import { buildCalendarDescription } from '../../../../../src/domain/policy/calendarDescription/factory';

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

describe('buildCalendarDescription', () => {
    const updateDate = new Date('2025-01-01T12:00:00+09:00');

    it('JRA_builderにルーティングする', () => {
        const result = buildCalendarDescription(JRA_ENTITY, updateDate);
        expect(result).toContain('レース情報(netkeiba)');
    });

    it('NAR_builderにルーティングする', () => {
        const result = buildCalendarDescription(NAR_ENTITY, updateDate);
        expect(result).toContain('距離:');
        expect(result).toContain('ダート');
    });

    it('KEIRIN_builderにルーティングする', () => {
        const result = buildCalendarDescription(KEIRIN_ENTITY, updateDate);
        expect(result).toContain('レース情報（netkeirin）');
    });

    it('AUTORACE_builderにルーティングする', () => {
        const result = buildCalendarDescription(AUTORACE_ENTITY, updateDate);
        expect(result).toContain('発走:');
    });

    it('BOATRACE_builderにルーティングする', () => {
        const result = buildCalendarDescription(BOATRACE_ENTITY, updateDate);
        expect(result).toContain('発走:');
    });

    it('OVERSEAS_builderにルーティングする', () => {
        const result = buildCalendarDescription(OVERSEAS_ENTITY, updateDate);
        expect(result).toContain('発走:');
    });

    it.each([
        ['JRA', JRA_ENTITY],
        ['NAR', NAR_ENTITY],
        ['KEIRIN', KEIRIN_ENTITY],
        ['AUTORACE', AUTORACE_ENTITY],
        ['BOATRACE', BOATRACE_ENTITY],
        ['OVERSEAS', OVERSEAS_ENTITY],
    ])('%s_builderでレース時刻を含む', (_raceType, entity) => {
        const result = buildCalendarDescription(entity, updateDate);
        expect(result).toContain('発走: 09:00');
    });

    it.each([
        ['JRA', JRA_ENTITY],
        ['NAR', NAR_ENTITY],
        ['KEIRIN', KEIRIN_ENTITY],
        ['AUTORACE', AUTORACE_ENTITY],
        ['BOATRACE', BOATRACE_ENTITY],
        ['OVERSEAS', OVERSEAS_ENTITY],
    ])('%s_builderで更新時刻を含む', (_raceType, entity) => {
        const result = buildCalendarDescription(entity, updateDate);
        expect(result).toContain('更新日時:');
    });
});
