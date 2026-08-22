import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import {
    buildJraRaceLinks,
    getJraDescription,
} from '../../../../../src/domain/policy/calendarDescription/jra.builder';

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

describe('getJraDescription', () => {
    it('レース時刻を含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getJraDescription(JRA_ENTITY, updateDate);

        expect(result).toContain('発走: 09:00');
    });

    it('レース情報リンクを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getJraDescription(JRA_ENTITY, updateDate);

        expect(result).toContain('レース情報(netkeiba)');
        // raceIdForNetkeiba = year(2025) + placeCode(05) + heldTimes(03) + heldDayTimes(01) + raceNumber(01) = 202505030101
        // netkeiba出馬表URLをnetkeibaリダイレクトURLでencodeURIComponentしたhrefを実値で検証
        expect(result).toContain(
            'href="https://netkeiba.page.link/?link=https%3A%2F%2Frace.sp.netkeiba.com%2Frace%2Fshutuba.html%3Frace_id%3D202505030101"',
        );
    });

    it('レース動画リンクを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getJraDescription(JRA_ENTITY, updateDate);

        expect(result).toContain('レース動画(netkeiba)');
        expect(result).toContain(
            'href="https://netkeiba.page.link/?link=https%3A%2F%2Frace.sp.netkeiba.com%2F%3Fpid%3Drace_movie%26race_id%3D202505030101"',
        );
    });

    it('YouTubeリンクを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getJraDescription(JRA_ENTITY, updateDate);

        expect(result).toContain('レース映像（公式YouTube）');
        // YoutubeUserIdMapForJra['東京'] = 'jraofficial'
        expect(result).toContain(
            'href="https://www.youtube.com/@jraofficial/stream"',
        );
    });

    it('更新時刻を含む', () => {
        const updateDate = new Date('2025-01-01T12:30:00+09:00');
        const result = getJraDescription(JRA_ENTITY, updateDate);

        expect(result).toContain('更新日時:');
        expect(result).toContain('12:30');
    });
});

describe('buildJraRaceLinks', () => {
    // placeHeldDays は省略可能なフィールドのため、未設定時は
    // heldTimes/heldDayTimes ともに 1 にフォールバックしてURLを組み立てる
    // （optional chaining + ?? 1 のフォールバック挙動を直接検証する）。
    it('placeHeldDaysが未設定の場合、heldTimes/heldDayTimesを1にフォールバックしてURLを組み立てる', () => {
        const entityWithoutPlaceHeldDays: RaceEntity = {
            ...JRA_ENTITY,
            placeHeldDays: undefined,
        };

        const links = buildJraRaceLinks(entityWithoutPlaceHeldDays);

        // raceIdForNetkeiba = year(2025) + placeCode(05) + heldTimes(01,フォールバック)
        // + heldDayTimes(01,フォールバック) + raceNumber(01) = 202505010101
        expect(links[0]?.url).toContain('race_id%3D202505010101');
    });
});
