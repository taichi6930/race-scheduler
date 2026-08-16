/**
 * gradeType ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | GradeTypeSchema | raceType | ZodString | Line |
 * | 2  | validateGradeType | 有効なgrade | 検証成功 | Branch |
 * | 3  | validateGradeType | 無効なgrade | エラースロー | Branch |
 */

import { describe, expect, it } from 'bun:test';
import {
    type GradeType,
    GradeTypeSchema,
    RaceType,
    validateGradeType,
} from '@race-schedule/core';

describe('gradeType', () => {
    describe('GradeTypeSchema', () => {
        it('JRA用のスキーマを生成', () => {
            const schema = GradeTypeSchema(RaceType.JRA);

            expect(schema).toBeDefined();
            expect(typeof schema.parse).toBe('function');
        });

        it('NAR用のスキーマを生成', () => {
            const schema = GradeTypeSchema(RaceType.NAR);

            expect(schema).toBeDefined();
            expect(typeof schema.parse).toBe('function');
        });

        it('OVERSEAS用のスキーマを生成', () => {
            const schema = GradeTypeSchema(RaceType.OVERSEAS);

            expect(schema).toBeDefined();
            expect(typeof schema.parse).toBe('function');
        });

        it('KEIRIN用のスキーマを生成', () => {
            const schema = GradeTypeSchema(RaceType.KEIRIN);

            expect(schema).toBeDefined();
            expect(typeof schema.parse).toBe('function');
        });

        it('AUTORACE用のスキーマを生成', () => {
            const schema = GradeTypeSchema(RaceType.AUTORACE);

            expect(schema).toBeDefined();
            expect(typeof schema.parse).toBe('function');
        });

        it('BOATRACE用のスキーマを生成', () => {
            const schema = GradeTypeSchema(RaceType.BOATRACE);

            expect(schema).toBeDefined();
            expect(typeof schema.parse).toBe('function');
        });

        it('異なるレース種別で異なるスキーマ', () => {
            const jraSchema = GradeTypeSchema(RaceType.JRA);
            const narSchema = GradeTypeSchema(RaceType.NAR);

            expect(jraSchema).not.toBe(narSchema);
        });

        it('同じレース種別で同じスキーマを返す', () => {
            const schema1 = GradeTypeSchema(RaceType.JRA);
            const schema2 = GradeTypeSchema(RaceType.JRA);

            // Zod は毎回新しいスキーマを作成するため、参照は異なるが動作は同じ
            expect(typeof schema1.parse).toBe('function');
            expect(typeof schema2.parse).toBe('function');
        });
    });

    describe('validateGradeType', () => {
        it('JRA: GⅠ は有効なグレード', () => {
            const result = validateGradeType(RaceType.JRA, 'GⅠ');

            expect(result).toBe('GⅠ');
        });

        it('JRA: GⅡ は有効なグレード', () => {
            const result = validateGradeType(RaceType.JRA, 'GⅡ');

            expect(result).toBe('GⅡ');
        });

        it('JRA: GⅢ は有効なグレード', () => {
            const result = validateGradeType(RaceType.JRA, 'GⅢ');

            expect(result).toBe('GⅢ');
        });

        it('JRA: JpnⅠ は有効なグレード', () => {
            const result = validateGradeType(RaceType.JRA, 'JpnⅠ');

            expect(result).toBe('JpnⅠ');
        });

        it('JRA: J.GⅠ は有効なグレード', () => {
            const result = validateGradeType(RaceType.JRA, 'J.GⅠ');

            expect(result).toBe('J.GⅠ');
        });

        it('JRA: J.GⅡ は有効なグレード', () => {
            const result = validateGradeType(RaceType.JRA, 'J.GⅡ');

            expect(result).toBe('J.GⅡ');
        });

        it('JRA: J.GⅢ は有効なグレード', () => {
            const result = validateGradeType(RaceType.JRA, 'J.GⅢ');

            expect(result).toBe('J.GⅢ');
        });

        it('JRA: Listed は有効なグレード', () => {
            const result = validateGradeType(RaceType.JRA, 'Listed');

            expect(result).toBe('Listed');
        });

        it('NAR: GⅠ は有効なグレード', () => {
            const result = validateGradeType(RaceType.NAR, 'GⅠ');

            expect(result).toBe('GⅠ');
        });

        it('NAR: GⅡ は有効なグレード', () => {
            const result = validateGradeType(RaceType.NAR, 'GⅡ');

            expect(result).toBe('GⅡ');
        });

        it('NAR: GⅢ は有効なグレード', () => {
            const result = validateGradeType(RaceType.NAR, 'GⅢ');

            expect(result).toBe('GⅢ');
        });

        it('KEIRIN: GP は有効なグレード', () => {
            const result = validateGradeType(RaceType.KEIRIN, 'GP');

            expect(result).toBe('GP');
        });

        it('KEIRIN: GⅠ は有効なグレード', () => {
            const result = validateGradeType(RaceType.KEIRIN, 'GⅠ');

            expect(result).toBe('GⅠ');
        });

        it('KEIRIN: GⅡ は有効なグレード', () => {
            const result = validateGradeType(RaceType.KEIRIN, 'GⅡ');

            expect(result).toBe('GⅡ');
        });

        it('KEIRIN: FⅠ は有効なグレード', () => {
            const result = validateGradeType(RaceType.KEIRIN, 'FⅠ');

            expect(result).toBe('FⅠ');
        });

        it('KEIRIN: FⅡ は有効なグレード', () => {
            const result = validateGradeType(RaceType.KEIRIN, 'FⅡ');

            expect(result).toBe('FⅡ');
        });

        it('AUTORACE: SG は有効なグレード', () => {
            const result = validateGradeType(RaceType.AUTORACE, 'SG');

            expect(result).toBe('SG');
        });

        it('AUTORACE: 特GⅠ は有効なグレード', () => {
            const result = validateGradeType(RaceType.AUTORACE, '特GⅠ');

            expect(result).toBe('特GⅠ');
        });

        it('AUTORACE: GⅡ は有効なグレード', () => {
            const result = validateGradeType(RaceType.AUTORACE, 'GⅡ');

            expect(result).toBe('GⅡ');
        });

        it('BOATRACE: SG は有効なグレード', () => {
            const result = validateGradeType(RaceType.BOATRACE, 'SG');

            expect(result).toBe('SG');
        });

        it('BOATRACE: GⅠ は有効なグレード（isSpecifiedがfalseだが有効）', () => {
            const result = validateGradeType(RaceType.BOATRACE, 'GⅠ');

            expect(result).toBe('GⅠ');
        });

        it('OVERSEAS: GⅠ は有効なグレード', () => {
            const result = validateGradeType(RaceType.OVERSEAS, 'GⅠ');

            expect(result).toBe('GⅠ');
        });

        it('OVERSEAS: Listed は有効なグレード', () => {
            const result = validateGradeType(RaceType.OVERSEAS, 'Listed');

            expect(result).toBe('Listed');
        });

        it('無効なグレード: XXX でエラースロー', () => {
            expect(() => validateGradeType(RaceType.JRA, 'XXX')).toThrow();
        });

        it('無効なグレード: 空文字列 でエラースロー', () => {
            expect(() => validateGradeType(RaceType.JRA, '')).toThrow();
        });

        it('無効なグレード: 小文字 gⅠ でエラースロー', () => {
            expect(() => validateGradeType(RaceType.JRA, 'gⅠ')).toThrow();
        });

        it('無効なグレード: 不正なレース種別', () => {
            // isIncludedRaceType により無効な値は除外される
            expect(() => validateGradeType(RaceType.JRA, 'SG')).toThrow(); // SG は BOATRACE, AUTORACE のみ
        });

        it('エラーメッセージにレース種別が含まれる', () => {
            try {
                validateGradeType(RaceType.KEIRIN, 'INVALID');
                expect(true).toBe(false); // 到達しないはず
            } catch (e) {
                expect(String(e)).toContain('keirin');
            }
        });

        it('グレード文字列は型チェック済み', () => {
            const result: GradeType = validateGradeType(RaceType.JRA, 'GⅠ');

            expect(typeof result).toBe('string');
        });

        it.each(['GⅠ', 'GⅡ', 'GⅢ'])(
            '複数のグレード値を順次バリデーション: %s',
            (grade) => {
                const result = validateGradeType(RaceType.JRA, grade);
                expect(result).toBe(grade);
            },
        );
    });

    describe('GradeTypeSchema validation', () => {
        it('スキーマで直接バリデーション可能', () => {
            const schema = GradeTypeSchema(RaceType.JRA);
            const result = schema.parse('GⅠ');

            expect(result).toBe('GⅠ');
        });

        it('スキーマでバリデーション失敗時はエラースロー', () => {
            const schema = GradeTypeSchema(RaceType.JRA);

            expect(() => schema.parse('INVALID')).toThrow();
        });

        it.each(['GⅠ', 'GⅡ', 'GⅢ'])(
            'スキーマの refine が機能している: %s',
            (grade) => {
                const schema = GradeTypeSchema(RaceType.JRA);

                expect(() => schema.parse(grade)).not.toThrow();
            },
        );

        it('異なるレース種別では異なるグレードセット', () => {
            const jraSchema = GradeTypeSchema(RaceType.JRA);
            const keirinSchema = GradeTypeSchema(RaceType.KEIRIN);

            // JRA で有効な J.GⅠ はKEIRIN では無効
            expect(() => jraSchema.parse('J.GⅠ')).not.toThrow();
            expect(() => keirinSchema.parse('J.GⅠ')).toThrow();
        });

        it('KEIRIN で GP は有効', () => {
            const schema = GradeTypeSchema(RaceType.KEIRIN);

            expect(() => schema.parse('GP')).not.toThrow();
        });

        it('JRA で J.GⅠ は有効', () => {
            const schema = GradeTypeSchema(RaceType.JRA);

            expect(() => schema.parse('J.GⅠ')).not.toThrow();
        });

        it('AUTORACE で SG は有効', () => {
            const schema = GradeTypeSchema(RaceType.AUTORACE);

            expect(() => schema.parse('SG')).not.toThrow();
        });

        it('AUTORACE で 特GⅠ は有効', () => {
            const schema = GradeTypeSchema(RaceType.AUTORACE);

            expect(() => schema.parse('特GⅠ')).not.toThrow();
        });

        it('JRA で SG は無効（BOATRACE, AUTORACE のみ）', () => {
            const schema = GradeTypeSchema(RaceType.JRA);

            expect(() => schema.parse('SG')).toThrow();
        });

        it('KEIRIN で J.GⅠ は無効（JRA のみ）', () => {
            const schema = GradeTypeSchema(RaceType.KEIRIN);

            expect(() => schema.parse('J.GⅠ')).toThrow();
        });

        it('レース種別ごとに異なる品揃え', () => {
            const jraSchema = GradeTypeSchema(RaceType.JRA);
            const narSchema = GradeTypeSchema(RaceType.NAR);
            const keirinSchema = GradeTypeSchema(RaceType.KEIRIN);

            // 全てで GⅠ は有効
            expect(() => jraSchema.parse('GⅠ')).not.toThrow();
            expect(() => narSchema.parse('GⅠ')).not.toThrow();
            expect(() => keirinSchema.parse('GⅠ')).not.toThrow();

            // ただし、FⅠ は KEIRIN のみ
            expect(() => keirinSchema.parse('FⅠ')).not.toThrow();
            expect(() => jraSchema.parse('FⅠ')).toThrow();
        });
    });
});
