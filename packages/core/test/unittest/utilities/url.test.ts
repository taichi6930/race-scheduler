/**
 * URL ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected URL Pattern | Coverage |
 * |----|----------|-------|----------------------|----------|
 * | 1  | createNetkeibaJraShutubaUrl | raceId="123456" | netkeiba.com/race/shutuba | Line |
 * | 2  | createNetkeibaJraRaceVideoUrl | raceId="123456" | netkeiba.com/?pid=race_movie | Line |
 * | 3  | createNetkeibaNarShutubaUrl | raceId="789012" | nar.sp.netkeiba.com | Line |
 * | 4  | createNetkeibaNarRaceVideoUrl | raceId="789012" | nar.sp.netkeiba.com | Line |
 */

import { describe, expect, it } from 'bun:test';
import {
    createNetkeibaJraRaceVideoUrl,
    createNetkeibaJraShutubaUrl,
    createNetkeibaNarRaceVideoUrl,
    createNetkeibaNarShutubaUrl,
    createNetkeibaRedirectUrl,
    createNetkeirinRaceShutubaUrl,
} from '@race-schedule/core';

describe('URL Utilities', () => {
    describe('JRA URL生成', () => {
        it('JRA出馬表URLを生成する', () => {
            const raceId = '202501010101';
            const url = createNetkeibaJraShutubaUrl(raceId);

            expect(url).toBe(
                `https://race.sp.netkeiba.com/race/shutuba.html?race_id=${raceId}`,
            );
            expect(url).toContain('race.sp.netkeiba.com');
            expect(url).toContain('shutuba.html');
            expect(url).toContain(raceId);
        });

        it('JRAレース動画URLを生成する', () => {
            const raceId = '202501010101';
            const url = createNetkeibaJraRaceVideoUrl(raceId);

            expect(url).toBe(
                `https://race.sp.netkeiba.com/?pid=race_movie&race_id=${raceId}`,
            );
            expect(url).toContain('race.sp.netkeiba.com');
            expect(url).toContain('pid=race_movie');
            expect(url).toContain(raceId);
        });
    });

    describe('NAR URL生成', () => {
        it('NAR出馬表URLを生成する', () => {
            const raceId = '202501010101';
            const url = createNetkeibaNarShutubaUrl(raceId);

            expect(url).toBe(
                `https://nar.sp.netkeiba.com/race/shutuba.html?race_id=${raceId}`,
            );
            expect(url).toContain('nar.sp.netkeiba.com');
            expect(url).toContain('shutuba.html');
            expect(url).toContain(raceId);
        });

        it('NARレース動画URLを生成する', () => {
            const raceId = '202501010101';
            const url = createNetkeibaNarRaceVideoUrl(raceId);

            expect(url).toBe(
                `https://nar.sp.netkeiba.com/race/race_movie.html?race_id=${raceId}`,
            );
            expect(url).toContain('nar.sp.netkeiba.com');
            expect(url).toContain('race_movie.html');
            expect(url).toContain(raceId);
        });
    });

    describe('競輪（KEIRIN） URL生成', () => {
        it('競輪出馬表URLを生成する', () => {
            const raceId = '202501010101';
            const url = createNetkeirinRaceShutubaUrl(raceId);

            expect(url).toBe(
                `https://keirin.netkeiba.com/race/entry/?race_id=${raceId}`,
            );
            expect(url).toContain('keirin.netkeiba.com');
            expect(url).toContain('/race/entry/');
            expect(url).toContain(raceId);
        });

        it('競輪URLは正しいドメインを使用', () => {
            const url = createNetkeirinRaceShutubaUrl('123456');
            expect(url).toContain('keirin.netkeiba.com');
            expect(url).not.toContain('nar.sp.netkeiba.com');
            expect(url).not.toContain('race.sp.netkeiba.com');
        });
    });

    describe('リダイレクトURL生成', () => {
        it('netkebaリダイレクトURLを生成する', () => {
            const originalUrl = 'https://example.com/page';
            const url = createNetkeibaRedirectUrl(originalUrl);

            expect(url).toContain('netkeiba.page.link');
            expect(url).toContain('?link=');
            expect(url).toContain(encodeURIComponent(originalUrl));
        });

        it('URLエンコードされたパラメータを含む', () => {
            const originalUrl =
                'https://race.sp.netkeiba.com/race/shutuba.html?race_id=202501010101';
            const encodedUrl = encodeURIComponent(originalUrl);
            const url = createNetkeibaRedirectUrl(originalUrl);

            expect(url).toBe(`https://netkeiba.page.link/?link=${encodedUrl}`);
        });

        it('特殊文字を含むURLは正しくエンコード', () => {
            const originalUrl = 'https://example.com/?key=value&other=data';
            const url = createNetkeibaRedirectUrl(originalUrl);

            expect(url).toContain('%3F'); // ?
            expect(url).toContain('%3D'); // =
            expect(url).toContain('%26'); // &
        });

        it('リダイレクトURLとして有効な文字列を返す', () => {
            const url = createNetkeibaRedirectUrl('https://example.com');
            expect(typeof url).toBe('string');
            expect(url.startsWith('https://')).toBe(true);
        });
    });

    describe('各URLで異なるraceIdを処理', () => {
        const testRaceIds = ['202401010101', '202412312412', '199901010001'];

        it.each(testRaceIds)('raceId="%s" でJRA出馬表URLを生成', (raceId) => {
            const url = createNetkeibaJraShutubaUrl(raceId);
            expect(url).toContain(raceId);
        });

        it.each(testRaceIds)('raceId="%s" でNAR出馬表URLを生成', (raceId) => {
            const url = createNetkeibaNarShutubaUrl(raceId);
            expect(url).toContain(raceId);
        });
    });

    describe('URLは常に文字列である', () => {
        it('すべての関数は文字列を返す', () => {
            const raceId = '202501010101';

            expect(typeof createNetkeibaJraShutubaUrl(raceId)).toBe('string');
            expect(typeof createNetkeibaJraRaceVideoUrl(raceId)).toBe('string');
            expect(typeof createNetkeibaNarShutubaUrl(raceId)).toBe('string');
            expect(typeof createNetkeibaNarRaceVideoUrl(raceId)).toBe('string');
        });
    });
});
