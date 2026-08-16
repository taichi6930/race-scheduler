/**
 * 方法3: エクスポートスモークテスト
 *
 * @race-schedule/core のパブリックAPIに対して、
 * 循環依存によって関数・スキーマが undefined になっていないことを検証するテスト。
 *
 * 循環依存が発生した場合、CJS 環境では以下のような問題が起きる：
 * - 関数がインポート時に undefined になる
 * - Zod スキーマの `.superRefine(fn)` で `fn is not a function` エラーが発生
 * - バリデーション実行まで発覚しない
 *
 * このテストはビルド・実行前にその問題を検出する安全網として機能する。
 */

import { describe, expect, it } from 'bun:test';
import {
    findPlaceNameByCode,
    // --- スキーマファクトリ（循環依存で undefined になりやすい） ---
    GradeTypeSchema,
    PlaceEntitySchema,
    parsePlaceId,
    RaceCourseSchema,
    // --- エンティティスキーマ ---
    RaceEntitySchema,
    RaceStageSchema,
    // --- 定数・型 ---
    RaceType,
    // --- superRefine コールバック（循環依存で undefined になりやすい） ---
    raceStageRequiredSuperRefine,
    shouldHaveConditionDataForHorse,
    shouldHavePlaceGradeForMechanical,
    validatePlaceEntity,
    validatePlaceId,
    // --- バリデーション関数 ---
    validateRaceEntity,
    // --- ユーティリティ関数 ---
    validateRaceId,
} from '@race-schedule/core';

describe('エクスポート整合性テスト（循環依存ガード）', () => {
    describe('バリデーション関数が undefined でないこと', () => {
        it('validateRaceEntity は function であること', () => {
            expect(typeof validateRaceEntity).toBe('function');
        });

        it('validatePlaceCommonEntity は function であること', () => {
            expect(typeof validatePlaceEntity).toBe('function');
        });

        it('validateRaceId は function であること', () => {
            expect(typeof validateRaceId).toBe('function');
        });

        it('validatePlaceId は function であること', () => {
            expect(typeof validatePlaceId).toBe('function');
        });
    });

    describe('superRefine コールバックが undefined でないこと', () => {
        it('raceStageRequiredSuperRefine は function であること', () => {
            expect(typeof raceStageRequiredSuperRefine).toBe('function');
        });

        it('requireConditionDataForHorse は function であること', () => {
            expect(typeof shouldHaveConditionDataForHorse).toBe('function');
        });

        it('shouldHavePlaceGradeForMechanical は function であること', () => {
            expect(typeof shouldHavePlaceGradeForMechanical).toBe('function');
        });
    });

    describe('スキーマファクトリが undefined でないこと', () => {
        it('GradeTypeSchema は function であること', () => {
            expect(typeof GradeTypeSchema).toBe('function');
        });

        it('RaceCourseSchema は function であること', () => {
            expect(typeof RaceCourseSchema).toBe('function');
        });

        it('RaceStageSchema は function であること', () => {
            expect(typeof RaceStageSchema).toBe('function');
        });
    });

    describe('エンティティスキーマが undefined でないこと', () => {
        it('RaceEntitySchema は ZodObject であること', () => {
            expect(RaceEntitySchema).toBeDefined();
            expect(typeof RaceEntitySchema.parse).toBe('function');
        });

        it('PlaceCommonEntitySchema は ZodObject であること', () => {
            expect(PlaceEntitySchema).toBeDefined();
            expect(typeof PlaceEntitySchema.parse).toBe('function');
        });
    });

    describe('スキーマファクトリが有効なスキーマを返すこと', () => {
        it('GradeTypeSchema(jra) は parse メソッドを持つこと', () => {
            const schema = GradeTypeSchema(RaceType.JRA);
            expect(typeof schema.parse).toBe('function');
        });

        it('RaceCourseSchema(nar) は parse メソッドを持つこと', () => {
            const schema = RaceCourseSchema(RaceType.NAR);
            expect(typeof schema.parse).toBe('function');
        });

        it('RaceStageSchema(keirin) は parse メソッドを持つこと', () => {
            const schema = RaceStageSchema(RaceType.KEIRIN);
            expect(typeof schema.parse).toBe('function');
        });
    });

    describe('ユーティリティ関数が動作すること', () => {
        it('parsePlaceId は function であること', () => {
            expect(typeof parsePlaceId).toBe('function');
        });

        it('findPlaceNameByCode は function であること', () => {
            expect(typeof findPlaceNameByCode).toBe('function');
        });
    });
});
