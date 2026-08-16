/**
 * RaceEntity のテスト
 *
 * ## デシジョンテーブル: RaceEntitySchema / validateRaceEntity
 *
 * | #  | raceType  | conditionData | raceStage | raceGrade | raceCourse | 期待結果              |
 * |----|-----------|---------------|-----------|-----------|------------|-----------------------|
 * | 1  | jra       | 有効          | なし      | GⅠ        | 中山       | パース成功            |
 * | 2  | nar       | 有効          | なし      | GⅠ        | 浦和       | パース成功            |
 * | 3  | keirin    | なし          | S級決勝   | GⅠ        | 函館       | パース成功            |
 * | 4  | autorace  | なし          | 優勝戦    | SG        | 飯塚       | パース成功            |
 * | 5  | boatrace  | なし          | 優勝戦    | SG        | 桐生       | パース成功            |
 * | 6  | jra       | なし          | なし      | GⅠ        | 中山       | エラー(conditionData必須)|
 * | 7  | keirin    | なし          | なし      | GⅠ        | 函館       | エラー(raceStage必須)|
 * | 8  | jra       | 有効          | なし      | 無効グレード | 中山     | エラー(raceGrade無効)|
 * | 9  | jra       | 有効          | なし      | GⅠ        | 無効場     | エラー(raceCourse無効)|
 * | 10 | jra       | 有効          | なし      | GⅠ        | 中山       | validateRaceEntity成功|
 * | 11 | undefined  | -            | -         | -         | -          | エラー(raceType必須) |
 */

import { describe, expect, it } from 'bun:test';
import { ZodError } from 'zod';
import { RaceType } from '../../../src/domain/model/valueObject/raceType';
import {
    RaceEntitySchema,
    validateRaceEntity,
} from '../../../src/entity/raceEntity';

const BASE_JRA = {
    raceId: 'jra202601270501',
    placeId: 'jra2026012705',
    raceType: RaceType.JRA,
    datetime: new Date('2026-01-27T00:00:00Z'),
    raceName: '有馬記念',
    raceNumber: 1,
    raceCourse: '中山',
    locationCode: '05',
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2500 },
};

const BASE_KEIRIN = {
    raceId: 'keirin202601271101',
    placeId: 'keirin2026012711',
    raceType: RaceType.KEIRIN,
    datetime: new Date('2026-01-27T00:00:00Z'),
    raceName: 'ケイリンレース',
    raceNumber: 1,
    raceCourse: '函館',
    locationCode: '11',
    raceGrade: 'GⅠ',
    raceStage: 'S級決勝',
};

describe('RaceEntitySchema', () => {
    describe('正常系: 有効なデータ', () => {
        it('#1: JRA の有効なエンティティをパースできる', () => {
            const result = RaceEntitySchema.safeParse(BASE_JRA);
            expect(result.success).toBe(true);
        });

        it('#2: NAR の有効なエンティティをパースできる', () => {
            const data = {
                raceId: 'nar202601271701',
                placeId: 'nar2026012717',
                raceType: RaceType.NAR,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceName: 'テストレース',
                raceNumber: 1,
                raceCourse: '浦和',
                locationCode: '17',
                raceGrade: 'GⅠ',
                conditionData: { surfaceType: 'ダート', distance: 1600 },
            };
            const result = RaceEntitySchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('#3: KEIRIN の有効なエンティティをパースできる', () => {
            const result = RaceEntitySchema.safeParse(BASE_KEIRIN);
            expect(result.success).toBe(true);
        });

        it('#4: AUTORACE の有効なエンティティをパースできる', () => {
            const data = {
                raceId: 'autorace202601270101',
                placeId: 'autorace2026012701',
                raceType: RaceType.AUTORACE,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceName: 'オートレース',
                raceNumber: 1,
                raceCourse: '飯塚',
                locationCode: '01',
                raceGrade: 'SG',
                raceStage: '優勝戦',
            };
            const result = RaceEntitySchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('#5: BOATRACE の有効なエンティティをパースできる', () => {
            const data = {
                raceId: 'boatrace202601270101',
                placeId: 'boatrace2026012701',
                raceType: RaceType.BOATRACE,
                datetime: new Date('2026-01-27T00:00:00Z'),
                raceName: 'ボートレース',
                raceNumber: 1,
                raceCourse: '桐生',
                locationCode: '01',
                raceGrade: 'SG',
                raceStage: '優勝戦',
            };
            const result = RaceEntitySchema.safeParse(data);
            expect(result.success).toBe(true);
        });
    });

    describe('異常系: バリデーションエラー', () => {
        it('#6: JRA で conditionData がない場合エラーになる', () => {
            const data = { ...BASE_JRA, conditionData: undefined };
            const result = RaceEntitySchema.safeParse(data);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(
                    result.error.issues.some((i) =>
                        i.message.includes('conditionData'),
                    ),
                ).toBe(true);
            }
        });

        it('#7: KEIRIN で raceStage がない場合エラーになる', () => {
            const data = { ...BASE_KEIRIN, raceStage: undefined };
            const result = RaceEntitySchema.safeParse(data);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(
                    result.error.issues.some(
                        (i) =>
                            i.message.includes('raceStage') ||
                            i.path.includes('raceStage'),
                    ),
                ).toBe(true);
            }
        });

        it('#8: 無効な raceGrade の場合エラーになる', () => {
            const data = { ...BASE_JRA, raceGrade: '無効グレード' };
            const result = RaceEntitySchema.safeParse(data);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(
                    result.error.issues.some((i) =>
                        i.path.includes('raceGrade'),
                    ),
                ).toBe(true);
            }
        });

        it('#9: 無効な raceCourse の場合エラーになる（superRefine が発火する）', () => {
            const data = { ...BASE_JRA, raceCourse: '無効な開催場所' };
            const result = RaceEntitySchema.safeParse(data);
            expect(result.success).toBe(false);
            if (!result.success) {
                // raceCourseSuperRefine の path は常に ['raceCourse'] に統一されている
                // （raceInvariants.ts:179 の通り、旧実装で ['placeName'] を使う不整合バグがあった）。
                // ここが 'placeName' 等に戻る回帰を検知する。
                expect(
                    result.error.issues.some((i) =>
                        i.path.includes('raceCourse'),
                    ),
                ).toBe(true);
            }
        });

        it('#11: raceType が undefined の場合エラーになる', () => {
            const data = { ...BASE_JRA, raceType: undefined };
            const result = RaceEntitySchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });
});

describe('validateRaceEntity', () => {
    it('#10: 有効なオブジェクトで RaceEntity を返す', () => {
        const result = validateRaceEntity(BASE_JRA);
        expect(result.raceType).toBe(RaceType.JRA);
        expect(result.raceCourse).toBe('中山');
    });

    it('#11: 無効なオブジェクトで ZodError をスローする', () => {
        expect(() =>
            validateRaceEntity({ ...BASE_JRA, raceGrade: 'INVALID' }),
        ).toThrow(ZodError);
    });
});
