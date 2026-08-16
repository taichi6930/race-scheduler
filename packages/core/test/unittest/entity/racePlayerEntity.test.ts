/**
 * RacePlayerEntity のテスト
 *
 * ## デシジョンテーブル: RacePlayerEntitySchema バリデーション
 *
 * | #  | carNumber | frameNumber | playerNo | playerName | term | branch | 期待結果               |
 * |----|-----------|-------------|----------|------------|------|--------|-------------------------|
 * |  1 | 7         | 6           | '014833' | '高久保雄介'| 100  | '京都' | パース成功（全項目あり） |
 * |  2 | 1         | 1           | '013679' | '真崎新太郎'| 省略 | 省略   | パース成功（term/branch省略可） |
 * |  3 | 0         | 1           | '014833' | '選手名'    | -    | -      | ZodError（carNumberは1以上） |
 * |  4 | 10        | 1           | '014833' | '選手名'    | -    | -      | ZodError（carNumberは9以下） |
 * |  5 | 1.5       | 1           | '014833' | '選手名'    | -    | -      | ZodError（carNumberは整数） |
 * |  6 | 1         | 0           | '014833' | '選手名'    | -    | -      | ZodError（frameNumberは1以上） |
 * |  7 | 1         | 10          | '014833' | '選手名'    | -    | -      | ZodError（frameNumberは9以下） |
 * |  8 | 1         | 1           | ''       | '選手名'    | -    | -      | ZodError（playerNo空文字禁止） |
 * |  9 | 1         | 1           | '014833' | ''         | -    | -      | ZodError（playerName空文字禁止） |
 * | 10 | 1         | 1           | '014833' | '選手名'    | 0    | -      | ZodError（termは正の整数） |
 * | 11 | 1         | 1           | '014833' | '選手名'    | -    | ''     | ZodError（branch空文字禁止） |
 *
 * ## デシジョンテーブル: validateRacePlayerEntity 関数
 *
 * | #  | 入力               | 期待結果                     |
 * |----|--------------------|-------------------------------|
 * | 12 | 有効なオブジェクト  | RacePlayerEntity を返す       |
 * | 13 | null               | ZodError をスロー              |
 */

import { describe, expect, it } from 'bun:test';

import {
    RacePlayerEntity,
    RacePlayerEntitySchema,
    validateRacePlayerEntity,
} from '../../../src/entity/racePlayerEntity';

const validBase: RacePlayerEntity = {
    carNumber: 7,
    frameNumber: 6,
    playerNo: '014833',
    playerName: '高久保雄介',
    term: 100,
    branch: '京都',
};

describe('RacePlayerEntitySchema', () => {
    it('#1: term/branchを含む全項目でパース成功する', () => {
        const result = RacePlayerEntitySchema.parse(validBase);

        expect(result).toEqual(validBase);
    });

    it('#2: term/branchを省略してもパース成功する', () => {
        const { term: _term, branch: _branch, ...rest } = validBase;

        const result = RacePlayerEntitySchema.parse({
            ...rest,
            carNumber: 1,
            frameNumber: 1,
            playerNo: '013679',
            playerName: '真崎新太郎',
        });

        expect(result.term).toBeUndefined();
        expect(result.branch).toBeUndefined();
    });

    describe('carNumber のバリデーション', () => {
        it('#3: carNumberが0でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({ ...validBase, carNumber: 0 }),
            ).toThrow('carNumber must be between 1 and 9');
        });

        it('#4: carNumberが10でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({ ...validBase, carNumber: 10 }),
            ).toThrow('carNumber must be between 1 and 9');
        });

        it('#5: carNumberが小数(1.5)でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({ ...validBase, carNumber: 1.5 }),
            ).toThrow('carNumber must be an integer');
        });
    });

    describe('frameNumber のバリデーション', () => {
        it('#6: frameNumberが0でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({ ...validBase, frameNumber: 0 }),
            ).toThrow('枠番は1以上である必要があります');
        });

        it('#7: frameNumberが10でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({
                    ...validBase,
                    frameNumber: 10,
                }),
            ).toThrow('枠番は9以下である必要があります');
        });
    });

    describe('playerNo のバリデーション', () => {
        it('#8: playerNoが空文字でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({ ...validBase, playerNo: '' }),
            ).toThrow('playerNo must not be empty');
        });
    });

    describe('playerName のバリデーション', () => {
        it('#9: playerNameが空文字でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({ ...validBase, playerName: '' }),
            ).toThrow('playerName must not be empty');
        });
    });

    describe('term のバリデーション', () => {
        it('#10: termが0でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({ ...validBase, term: 0 }),
            ).toThrow('term must be positive');
        });
    });

    describe('branch のバリデーション', () => {
        it('#11: branchが空文字でZodErrorをスローする', () => {
            expect(() =>
                RacePlayerEntitySchema.parse({ ...validBase, branch: '' }),
            ).toThrow('branch must not be empty');
        });
    });
});

describe('validateRacePlayerEntity', () => {
    it('#12: 有効なオブジェクトを渡すとRacePlayerEntityを返す', () => {
        const result = validateRacePlayerEntity(validBase);

        expect(result).toEqual(validBase);
    });

    it('#13: nullでZodErrorをスローする', () => {
        expect(() => validateRacePlayerEntity(null)).toThrow();
    });
});
