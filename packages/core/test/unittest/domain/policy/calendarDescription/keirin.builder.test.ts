import { describe, expect, it } from 'bun:test';
import {
    type RaceEntity,
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';
import { getKeirinDescription } from '../../../../../src/domain/policy/calendarDescription/keirin.builder';

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

describe('getKeirinDescription', () => {
    it('レース時刻を含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getKeirinDescription(KEIRIN_ENTITY, updateDate);

        expect(result).toContain('発走: 09:00');
    });

    it('レース情報リンクを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getKeirinDescription(KEIRIN_ENTITY, updateDate);

        expect(result).toContain('レース情報（netkeirin）');
        // raceIdForNetkeirin = year(2025) + month(01) + day(01) + placeCode(函館) + raceNumber(01) = 202501011101
        expect(result).toContain(
            'href="https://keirin.netkeiba.com/race/entry/?race_id=202501011101"',
        );
    });

    it('YouTubeリンクを含む', () => {
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getKeirinDescription(KEIRIN_ENTITY, updateDate);

        expect(result).toContain('レース映像（公式YouTube）');
        // YoutubeUserIdMapForKeirin['函館'] = 'rinrin-hakodate-Keirin'
        expect(result).toContain(
            'href="https://www.youtube.com/@rinrin-hakodate-Keirin/stream"',
        );
    });

    it('GPグレードでぺーちゃんねるリンクを含む', () => {
        const gpEntity = { ...KEIRIN_ENTITY, raceGrade: 'GP' };
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getKeirinDescription(gpEntity, updateDate);

        // ラベルの厳密一致（アンカータグのテキスト部分）を検証する。
        // 'ぺーちゃんねる' という部分文字列だけだとYouTubeチャンネル名URL
        // （@加藤慎平のぺーちゃんねる）にも含まれてしまい、ラベル文言自体の
        // 破壊を検知できないため、アンカータグの開始・終了込みで厳密に検証する。
        expect(result).toContain('>レース映像（ぺーちゃんねる）<');
        expect(result).toContain(
            'href="https://www.youtube.com/@加藤慎平のぺーちゃんねる/stream"',
        );
    });

    // GP以外にもGⅠ/GⅡ/GⅢのいずれのグレードでもぺーちゃんねるリンクを含むことを網羅する
    // （isShowPeChannelの判定配列['GP','GⅠ','GⅡ','GⅢ']の各要素を個別に検証）
    it.each(['GP', 'GⅠ', 'GⅡ', 'GⅢ'] as const)(
        '%sグレードでぺーちゃんねるリンクを含む',
        (grade) => {
            const entity = { ...KEIRIN_ENTITY, raceGrade: grade };
            const updateDate = new Date('2025-01-01T12:00:00+09:00');
            const result = getKeirinDescription(entity, updateDate);

            expect(result).toContain('>レース映像（ぺーちゃんねる）<');
        },
    );

    it('下位グレードではぺーちゃんねるリンクを含まない', () => {
        const f1Entity = { ...KEIRIN_ENTITY, raceGrade: 'FⅠ' };
        const updateDate = new Date('2025-01-01T12:00:00+09:00');
        const result = getKeirinDescription(f1Entity, updateDate);

        expect(result).not.toContain('ぺーちゃんねる');
    });

    it('更新時刻を含む', () => {
        const updateDate = new Date('2025-01-01T12:30:00+09:00');
        const result = getKeirinDescription(KEIRIN_ENTITY, updateDate);

        expect(result).toContain('更新日時:');
        expect(result).toContain('12:30');
    });
});
