/**
 * domain/service/courseCode/netkeibaCourseCode テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | RaceType | RaceCourse | Expected | Coverage |
 * |----|----------|----------|-----------|----------|----------|
 * | 1  | createPlaceCodeForOfficial | JRA | 東京 | '05' | Line, Branch |
 * | 2  | createPlaceCodeForOfficial | JRA | 無効 | '' | Line, Branch |
 * | 3  | createPlaceCodeForOfficial | NAR | 園田 | '27' | Line, Branch |
 * | 4  | createPlaceCodeForOfficial | JRA/NAR | 無効な競馬場名 | '' | Line, Branch |
 * | 5  | createPlaceCodeForNetkeiba | JRA | 東京 | '05' | Line, Branch |
 * | 6  | createPlaceCodeForNetkeiba | JRA | 無効 | '' | Line, Branch |
 * | 7  | createPlaceCodeForNetkeiba | NAR | 園田 | '50' | Line, Branch |
 * | 8  | createPlaceCodeForNetkeiba | JRA/NAR | 無効な競馬場名 | '' | Line, Branch |
 * | 9  | Official vs Netkeiba | NAR | 園田 | '27' !== '50'（実在する差異ペア） | Line |
 * | 10 | エッジケース | JRA | 空文字 / スペース混在 | '' | Branch |
 */

import { describe, expect, it } from 'bun:test';
import {
    createPlaceCodeForNetkeiba,
    createPlaceCodeForOfficial,
    RaceType,
} from '@race-schedule/core';

describe('RaceCourse Utilities', () => {
    describe('createPlaceCodeForOfficial', () => {
        it('JRA の有効な競馬場名(東京)からプレースコード05を取得', () => {
            const result = createPlaceCodeForOfficial(RaceType.JRA, '東京');

            expect(result).toBe('05');
        });

        it('JRA の無効な競馬場名は空文字を返す', () => {
            const result = createPlaceCodeForOfficial(
                RaceType.JRA,
                '存在しないコース',
            );
            expect(result).toBe('');
        });

        it('NAR の競馬場名(園田)からプレースコード27を取得', () => {
            const result = createPlaceCodeForOfficial(RaceType.NAR, '園田');
            expect(result).toBe('27');
        });

        it.each([
            ['JRAで無効なコース', RaceType.JRA],
            ['NARで無効なコース', RaceType.NAR],
        ])('%s は空文字を返す', (_title, raceType) => {
            const result = createPlaceCodeForOfficial(raceType, '無効');
            expect(result).toBe('');
        });
    });

    describe('createPlaceCodeForNetkeiba', () => {
        it('JRA の有効な競馬場名(東京)から netkeiba プレースコード05を取得', () => {
            const result = createPlaceCodeForNetkeiba(RaceType.JRA, '東京');
            expect(result).toBe('05');
        });

        it('JRA の無効な競馬場名は空文字を返す', () => {
            const result = createPlaceCodeForNetkeiba(
                RaceType.JRA,
                '存在しないコース',
            );
            expect(result).toBe('');
        });

        it('NAR の競馬場名(園田)から netkeiba プレースコード50を取得', () => {
            const result = createPlaceCodeForNetkeiba(RaceType.NAR, '園田');
            expect(result).toBe('50');
        });

        it.each([
            ['JRAで無効なコース', RaceType.JRA],
            ['NARで無効なコース', RaceType.NAR],
        ])('%s は空文字を返す', (_title, raceType) => {
            const result = createPlaceCodeForNetkeiba(raceType, '無効');
            expect(result).toBe('');
        });
    });

    describe('Official と Netkeiba の違い', () => {
        it('NAR園田では Official(27) と Netkeiba(50) で異なるコードが実在する', () => {
            const officialCode = createPlaceCodeForOfficial(
                RaceType.NAR,
                '園田',
            );
            const netkeibaCode = createPlaceCodeForNetkeiba(
                RaceType.NAR,
                '園田',
            );

            expect(officialCode).toBe('27');
            expect(netkeibaCode).toBe('50');
            expect(officialCode).not.toBe(netkeibaCode);
        });

        it('JRA東京では Official(05) と Netkeiba(05) で同じコードになる', () => {
            const officialCode = createPlaceCodeForOfficial(
                RaceType.JRA,
                '東京',
            );
            const netkeibaCode = createPlaceCodeForNetkeiba(
                RaceType.JRA,
                '東京',
            );

            expect(officialCode).toBe('05');
            expect(netkeibaCode).toBe('05');
            expect(officialCode).toBe(netkeibaCode);
        });
    });

    describe('エッジケース', () => {
        it('空の競馬場名は空文字を返す', () => {
            const result1 = createPlaceCodeForOfficial(RaceType.JRA, '');
            const result2 = createPlaceCodeForNetkeiba(RaceType.JRA, '');
            expect(result1).toBe('');
            expect(result2).toBe('');
        });

        it('前後にスペースを含む競馬場名は完全一致しないため空文字を返す', () => {
            const result1 = createPlaceCodeForOfficial(RaceType.JRA, ' 東京 ');
            const result2 = createPlaceCodeForNetkeiba(RaceType.JRA, ' 東京 ');
            expect(result1).toBe('');
            expect(result2).toBe('');
        });
    });
});
