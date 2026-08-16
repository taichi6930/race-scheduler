/**
 * CourseSchema のユニットテスト
 *
 * ## デシジョンテーブル（CourseSchema.parse）
 *
 * | #    | raceType | raceCourse | placeCode | 期待結果 |
 * |------|----------|------------|-----------|----------|
 * | T-01 | JRA | '札幌'（有効） | '01' | 検証成功 |
 * | T-02 | BOATRACE | '桐生'（有効） | '01' | 検証成功 |
 * | T-03 | JRA | '桐生'（BOATRACE専用） | '01' | エラースロー（raceCourseがraceTypeに存在しない） |
 * | T-04 | JRA | '札幌'（有効） | 'AB'（不正な形式） | エラースロー（placeCodeが2桁数字でない） |
 * | T-05 | JRA | '存在しない競馬場' | '01' | エラー path が ['raceCourse'] になる（superRefineの経路確認） |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import { CourseSchema } from '../../../../../src/domain/model/valueObject/course';

describe('CourseSchema', () => {
    it('[T-01] JRA: 札幌・placeCode 01 は検証成功する', () => {
        const result = CourseSchema.parse({
            raceType: RaceType.JRA,
            raceCourse: '札幌',
            placeCode: '01',
        });

        expect(result.raceCourse).toBe('札幌');
        expect<string>(result.placeCode).toBe('01');
    });

    it('[T-02] BOATRACE: 桐生・placeCode 01 は検証成功する', () => {
        const result = CourseSchema.parse({
            raceType: RaceType.BOATRACE,
            raceCourse: '桐生',
            placeCode: '01',
        });

        expect(result.raceCourse).toBe('桐生');
    });

    it('[T-03] JRA: BOATRACE専用の開催場（桐生）はJRAでは無効', () => {
        expect(() =>
            CourseSchema.parse({
                raceType: RaceType.JRA,
                raceCourse: '桐生',
                placeCode: '01',
            }),
        ).toThrow();
    });

    it('[T-04] placeCodeが2桁の数字でない場合はエラースロー', () => {
        expect(() =>
            CourseSchema.parse({
                raceType: RaceType.JRA,
                raceCourse: '札幌',
                placeCode: 'AB',
            }),
        ).toThrow('locationCodeは2桁の数字で指定してください 例: 01, 02, 03');
    });

    it('[T-05] 不正なraceCourseのエラーはpath:[raceCourse]で報告される', () => {
        const result = CourseSchema.safeParse({
            raceType: RaceType.JRA,
            raceCourse: '存在しない競馬場',
            placeCode: '01',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.path).toEqual(['raceCourse']);
        }
    });
});
