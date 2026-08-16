import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import { getNarDescription } from '../../../../../src/domain/policy/calendarDescription/nar.builder';

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

describe('getNarDescription', () => {
    it('馬場条件データを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getNarDescription(NAR_ENTITY, updateDate);

        expect(result).toContain('距離:');
        expect(result).toContain('ダート');
        expect(result).toContain('1600');
    });

    it('条件データ欠落時も処理する', () => {
        const entityWithoutCondition = {
            ...NAR_ENTITY,
            conditionData: undefined,
        };
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getNarDescription(entityWithoutCondition, updateDate);

        expect(result).not.toContain('距離:');
        expect(result).toContain('発走:');
    });

    it('レース時刻を含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getNarDescription(NAR_ENTITY, updateDate);

        expect(result).toContain('発走: 09:00');
    });

    it('レース情報リンクを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getNarDescription(NAR_ENTITY, updateDate);

        expect(result).toContain('レース情報（netkeiba）');
        // raceIdForNetkeiba = year(2025) + placeCode(大井=44) + month(01) + day(01) + raceNumber(01) = 202544010101
        expect(result).toContain(
            'href="https://netkeiba.page.link/?link=https%3A%2F%2Fnar.sp.netkeiba.com%2Frace%2Fshutuba.html%3Frace_id%3D202544010101"',
        );
    });

    it('レース動画リンクを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getNarDescription(NAR_ENTITY, updateDate);

        expect(result).toContain('レース動画（netkeiba）');
        expect(result).toContain(
            'href="https://netkeiba.page.link/?link=https%3A%2F%2Fnar.sp.netkeiba.com%2Frace%2Frace_movie.html%3Frace_id%3D202544010101"',
        );
    });

    it('YouTubeリンクを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getNarDescription(NAR_ENTITY, updateDate);

        expect(result).toContain('レース映像（YouTube）');
        // YoutubeUserIdMapForNar['大井'] = 'tckkeiba'
        expect(result).toContain(
            'href="https://www.youtube.com/@tckkeiba/stream"',
        );
    });

    it('更新時刻を含む', () => {
        const updateDate = new Date('2025-01-01T12:30:00+09:00');
        const result = getNarDescription(NAR_ENTITY, updateDate);

        expect(result).toContain('更新日時:');
        expect(result).toContain('12:30');
    });
});
