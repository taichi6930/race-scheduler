/**
 * PlayerEntity のテスト
 *
 * ## デシジョンテーブル: PlayerEntitySchema バリデーション
 *
 * | #  | raceType       | playerNo   | playerName | priority | 期待結果                                    |
 * |----|----------------|------------|------------|----------|---------------------------------------------|
 * |  1 | 'jra'（有効）  | '001'      | '山田太郎'  | 0        | パース成功                                  |
 * |  2 | 'nar'（有効）  | 'A99'      | 'テスト選手' | 10      | パース成功                                  |
 * |  3 | 'keirin'(有効) | '100'      | '選手名'    | 999      | パース成功                                  |
 * |  4 | 'overseas'(有) | '200'      | 'Name'     | 1        | パース成功                                  |
 * |  5 | 'autorace'(有) | 'P01'      | '太郎'      | 5        | パース成功                                  |
 * |  6 | 'boatrace'(有) | 'B10'      | '花子'      | 2        | パース成功                                  |
 * |  7 | 無効な文字列    | '001'      | '名前'      | 0        | ZodError スロー                             |
 * |  8 | 'jra'          | ''（空文字）| '名前'      | 0        | ZodError スロー（playerNo 空文字禁止）       |
 * |  9 | 'jra'          | '001'      | ''（空文字） | 0        | ZodError スロー（playerName 空文字禁止）     |
 * | 10 | 'jra'          | '001'      | '名前'      | -1       | ZodError スロー（priority は 0 以上）        |
 * | 11 | 'jra'          | '001'      | '名前'      | 1.5      | ZodError スロー（priority は整数のみ）       |
 * | 12 | undefined      | '001'      | '名前'      | 0        | ZodError スロー（raceType 必須）             |
 * | 13 | 'jra'          | undefined  | '名前'      | 0        | ZodError スロー（playerNo 必須）             |
 * | 14 | 'jra'          | '001'      | undefined  | 0        | ZodError スロー（playerName 必須）           |
 * | 15 | 'jra'          | '001'      | '名前'      | undefined | ZodError スロー（priority 必須）            |
 * | 22 | term=100, branch='京都' | - | - | - | パース成功（term/branchは省略可の任意フィールド） |
 * | 23 | term=0（0以下） | - | - | - | ZodError スロー（term は正の整数のみ） |
 * | 24 | branch=''（空文字） | - | - | - | ZodError スロー（branch 空文字禁止） |
 *
 * ## デシジョンテーブル: validatePlayerEntity 関数
 *
 * | #  | 入力               | 期待結果                                |
 * |----|--------------------|-----------------------------------------|
 * | 16 | 有効なオブジェクト  | PlayerEntity を返す                     |
 * | 17 | 無効なオブジェクト  | ZodError をスロー                        |
 * | 18 | null               | ZodError をスロー                        |
 * | 19 | undefined          | ZodError をスロー                        |
 * | 20 | 文字列             | ZodError をスロー                        |
 */

import { describe, expect, it } from 'bun:test';

import {
    PlayerEntity,
    PlayerEntitySchema,
    validatePlayerEntity,
} from '../../../src/entity/playerEntity';

const validBase: PlayerEntity = {
    raceType: 'jra',
    playerNo: '001',
    playerName: '山田太郎',
    priority: 0,
};

describe('PlayerEntitySchema', () => {
    // =========================================================================
    // 正常系: 有効な raceType すべて
    // =========================================================================
    describe('有効な raceType', () => {
        it('#1: raceType=jra で正常にパースできる', () => {
            const result = PlayerEntitySchema.parse(validBase);

            expect(result.raceType).toBe('jra');
        });

        it('#2: raceType=nar で正常にパースできる', () => {
            const result = PlayerEntitySchema.parse({
                ...validBase,
                raceType: 'nar',
                playerNo: 'A99',
                playerName: 'テスト選手',
                priority: 10,
            });

            expect(result.raceType).toBe('nar');
        });

        it('#3: raceType=keirin で正常にパースできる', () => {
            const result = PlayerEntitySchema.parse({
                ...validBase,
                raceType: 'keirin',
                priority: 999,
            });

            expect(result.raceType).toBe('keirin');
        });

        it('#4: raceType=overseas で正常にパースできる', () => {
            const result = PlayerEntitySchema.parse({
                ...validBase,
                raceType: 'overseas',
                playerNo: '200',
                playerName: 'Name',
                priority: 1,
            });

            expect(result.raceType).toBe('overseas');
        });

        it('#5: raceType=autorace で正常にパースできる', () => {
            const result = PlayerEntitySchema.parse({
                ...validBase,
                raceType: 'autorace',
                playerNo: 'P01',
                playerName: '太郎',
                priority: 5,
            });

            expect(result.raceType).toBe('autorace');
        });

        it('#6: raceType=boatrace で正常にパースできる', () => {
            const result = PlayerEntitySchema.parse({
                ...validBase,
                raceType: 'boatrace',
                playerNo: 'B10',
                playerName: '花子',
                priority: 2,
            });

            expect(result.raceType).toBe('boatrace');
        });
    });

    // =========================================================================
    // 異常系: raceType
    // =========================================================================
    describe('raceType のバリデーション', () => {
        it('#7: 無効な raceType で ZodError をスローする', () => {
            expect(() =>
                PlayerEntitySchema.parse({ ...validBase, raceType: 'invalid' }),
            ).toThrow('Invalid option: expected one of');
        });

        it('#12: raceType が undefined で ZodError をスローする', () => {
            const { raceType: _, ...rest } = validBase;
            expect(() => PlayerEntitySchema.parse(rest)).toThrow(
                'Invalid option: expected one of',
            );
        });

        it('#21: raceType が空文字で ZodError をスローする', () => {
            expect(() =>
                PlayerEntitySchema.parse({ ...validBase, raceType: '' }),
            ).toThrow('Invalid option: expected one of');
        });
    });

    // =========================================================================
    // 異常系: playerNo
    // =========================================================================
    describe('playerNo のバリデーション', () => {
        it('#8: playerNo が空文字で ZodError をスローする', () => {
            expect(() =>
                PlayerEntitySchema.parse({ ...validBase, playerNo: '' }),
            ).toThrow('playerNo must not be empty');
        });

        it('#13: playerNo が undefined で ZodError をスローする', () => {
            const { playerNo: _, ...rest } = validBase;
            expect(() => PlayerEntitySchema.parse(rest)).toThrow(
                'Invalid input: expected string, received undefined',
            );
        });
    });

    // =========================================================================
    // 異常系: playerName
    // =========================================================================
    describe('playerName のバリデーション', () => {
        it('#9: playerName が空文字で ZodError をスローする', () => {
            expect(() =>
                PlayerEntitySchema.parse({ ...validBase, playerName: '' }),
            ).toThrow('playerName must not be empty');
        });

        it('#14: playerName が undefined で ZodError をスローする', () => {
            const { playerName: _, ...rest } = validBase;
            expect(() => PlayerEntitySchema.parse(rest)).toThrow(
                'Invalid input: expected string, received undefined',
            );
        });
    });

    // =========================================================================
    // 異常系: priority
    // =========================================================================
    describe('priority のバリデーション', () => {
        it('#10: priority が -1 で ZodError をスローする', () => {
            expect(() =>
                PlayerEntitySchema.parse({ ...validBase, priority: -1 }),
            ).toThrow('priority must be non-negative');
        });

        it('#11: priority が小数（1.5）で ZodError をスローする', () => {
            expect(() =>
                PlayerEntitySchema.parse({ ...validBase, priority: 1.5 }),
            ).toThrow('priority must be an integer');
        });

        it('#15: priority が undefined で ZodError をスローする', () => {
            const { priority: _, ...rest } = validBase;
            expect(() => PlayerEntitySchema.parse(rest)).toThrow(
                'Invalid input: expected number, received undefined',
            );
        });
    });

    // =========================================================================
    // 正常系・異常系: term / branch（KPLAYER-07、player_keirinからの補完）
    // =========================================================================
    describe('term / branch のバリデーション', () => {
        it('#22: term/branchを指定すると正常にパースできる', () => {
            const result = PlayerEntitySchema.parse({
                ...validBase,
                term: 100,
                branch: '京都',
            });

            expect(result.term).toBe(100);
            expect(result.branch).toBe('京都');
        });

        it('#23: termが0以下でZodErrorをスローする', () => {
            expect(() =>
                PlayerEntitySchema.parse({ ...validBase, term: 0 }),
            ).toThrow('term must be positive');
        });

        it('#24: branchが空文字でZodErrorをスローする', () => {
            expect(() =>
                PlayerEntitySchema.parse({ ...validBase, branch: '' }),
            ).toThrow('branch must not be empty');
        });
    });
});

describe('validatePlayerEntity', () => {
    it('#16: 有効なオブジェクトを渡すと PlayerEntity を返す', () => {
        const result = validatePlayerEntity(validBase);

        expect(result).toEqual(validBase);
    });

    it('#17: 無効なオブジェクト（raceType=invalid）で ZodError をスローする', () => {
        expect(() =>
            validatePlayerEntity({ ...validBase, raceType: 'invalid' }),
        ).toThrow('Invalid option: expected one of');
    });

    it('#18: null で ZodError をスローする', () => {
        expect(() => validatePlayerEntity(null)).toThrow(
            'Invalid input: expected object, received null',
        );
    });

    it('#19: undefined で ZodError をスローする', () => {
        expect(() => validatePlayerEntity(undefined)).toThrow(
            'Invalid input: expected object, received undefined',
        );
    });

    it('#20: 文字列で ZodError をスローする', () => {
        expect(() => validatePlayerEntity('not an object')).toThrow(
            'Invalid input: expected object, received string',
        );
    });
});
