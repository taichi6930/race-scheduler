import { describe, expect, it } from 'bun:test';
import {
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';

import {
    CalendarFactory,
    PlaceFactory,
    PlayerFactory,
    RaceFactory,
} from '../factories';

describe('shared/factories', () => {
    describe('RaceFactory', () => {
        it('create_デフォルト_JRA東京の有効なRaceEntityを返す', () => {
            const race = RaceFactory.create();

            expect(race.raceType).toBe('jra');
            expect<string>(race.locationCode).toBe('05');
            expect(race.raceCourse).toBe('東京');
            expect(race.raceNumber).toBe(1);
            // raceId/placeId は raceType + JST日付(yyyyMMdd) + locationCode(2桁) [+ raceNumber(2桁)] から
            // 決定的に導出される（generatePlaceId/generateRaceId = composePlaceId/composeRaceId）。
            // datetime='2026-04-26T10:00:00+09:00', locationCode='05' から具体値を固定する。
            expect(race.placeId).toBe(validatePlaceId('jra2026042605'));
            expect(race.raceId).toBe(validateRaceId('jra202604260501'));
        });

        it('create_overrides指定_上書きされた値で生成', () => {
            const race = RaceFactory.create({
                overrides: { raceName: 'カスタム杯' },
            });
            expect(race.raceName).toBe('カスタム杯');
        });

        it('createMany_count指定_連番のRaceNumberで配列生成', () => {
            const races = RaceFactory.createMany(3);
            expect(races).toHaveLength(3);
            expect(races.map((r) => r.raceNumber)).toEqual([1, 2, 3]);
        });

        it('createMany_variantAt指定_インデックスごとに異なるraceTypeを混在生成', () => {
            const raceTypes = [RaceType.JRA, RaceType.KEIRIN, RaceType.JRA];
            const races = RaceFactory.createMany(3, {}, (index) => ({
                raceType: raceTypes[index],
                locationCode:
                    raceTypes[index] === RaceType.KEIRIN
                        ? validateLocationCode('11')
                        : undefined,
            }));

            expect(races.map((r) => r.raceType)).toEqual([
                'jra',
                'keirin',
                'jra',
            ]);
            // raceNumberの連番生成（既定の異質性）はvariantAt指定時も維持される
            expect(races.map((r) => r.raceNumber)).toEqual([1, 2, 3]);
        });

        it('create_raceTypeに対し無効なlocationCode_エラーを投げる', () => {
            expect(() =>
                RaceFactory.create({
                    raceType: RaceType.JRA,
                    // '11' はKEIRIN専用の開催場コード（函館）でJRAには存在しない
                    locationCode: validateLocationCode('11'),
                }),
            ).toThrow(
                'RaceFactory: locationCode "11" は raceType "jra" に対する有効な開催場ではありません',
            );
        });
    });

    describe('PlaceFactory', () => {
        it('create_デフォルト_有効なPlaceEntityを返す', () => {
            const place = PlaceFactory.create();
            expect(place.raceType).toBe('jra');
            expect(place.raceCourse).toBe('東京');
        });

        it('createMany_3件_日付が1日ずつ昇順で進む', () => {
            const places = PlaceFactory.createMany(3);
            expect(places).toHaveLength(3);
            // デフォルトdatetime(2026-04-26T10:00:00+09:00)を起点に、日次(24h)で厳密に進むことを検証する。
            expect(places.map((p) => p.datetime.toISOString())).toEqual([
                '2026-04-26T01:00:00.000Z',
                '2026-04-27T01:00:00.000Z',
                '2026-04-28T01:00:00.000Z',
            ]);
            // placeId（JST日付を含む）も日次で昇順に変化することを併せて検証する。
            expect(places.map((p) => p.placeId)).toEqual([
                validatePlaceId('jra2026042605'),
                validatePlaceId('jra2026042705'),
                validatePlaceId('jra2026042805'),
            ]);
        });

        it('create_overrides指定_上書きされた値で生成', () => {
            const place = PlaceFactory.create({
                overrides: { isRaceListAvailable: true },
            });
            expect(place.isRaceListAvailable).toBe(true);
        });

        it('createMany_variantAt指定_インデックスごとに異なるplaceGradeを混在生成', () => {
            const grades = ['GⅠ', undefined, 'GⅡ'] as const;
            const places = PlaceFactory.createMany(3, {}, (index) => ({
                placeGrade: grades[index],
            }));

            expect(places.map((p) => p.placeGrade)).toEqual([
                'GⅠ',
                undefined,
                'GⅡ',
            ]);
        });
    });

    describe('PlayerFactory', () => {
        it('create_デフォルト_有効なPlayerEntityを返す', () => {
            const player = PlayerFactory.create();
            expect(player.playerNo).toBe('00001');
            expect(player.playerName).toBe('テスト太郎');
            expect(player.priority).toBe(0);
        });

        it('createMany_3件_playerNoが連番で生成される', () => {
            const players = PlayerFactory.createMany(3);
            expect(players.map((p) => p.playerNo)).toEqual([
                '00001',
                '00002',
                '00003',
            ]);
        });

        it('createMany_variantAt指定_インデックスごとに異なるpriorityを混在生成', () => {
            const priorities = [0, 5, 0];
            const players = PlayerFactory.createMany(3, {}, (index) => ({
                priority: priorities[index],
            }));

            expect(players.map((p) => p.priority)).toEqual([0, 5, 0]);
            // playerNoの連番生成（既定の異質性）はvariantAt指定時も維持される
            expect(players.map((p) => p.playerNo)).toEqual([
                '00001',
                '00002',
                '00003',
            ]);
        });
    });

    describe('CalendarFactory', () => {
        it('create_デフォルト_有効なCalendarDataEntityを返す', () => {
            const cal = CalendarFactory.create();
            expect(cal.id).toBe('evt-test-001');
            expect(cal.title).toBe('テストレース');
        });

        it('createMany_3件_idが連番で生成される', () => {
            const cals = CalendarFactory.createMany(3);
            expect(cals.map((c) => c.id)).toEqual([
                'evt-test-001',
                'evt-test-002',
                'evt-test-003',
            ]);
        });

        it('createMany_variantAt指定_インデックスごとに異なるraceTypeを混在生成', () => {
            const raceTypes = [RaceType.JRA, RaceType.KEIRIN, RaceType.JRA];
            const cals = CalendarFactory.createMany(3, {}, (index) => ({
                raceType: raceTypes[index],
            }));

            expect(cals.map((c) => c.raceType)).toEqual([
                'jra',
                'keirin',
                'jra',
            ]);
        });
    });
});
