import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { makeValidator } from '../../../src/utilities/makeValidator';

/**
 * makeValidator のデシジョンテーブル
 *
 * | #    | 入力                                             | 期待される挙動                                       |
 * | ---- | ------------------------------------------------ | ----------------------------------------------------- |
 * | T-01 | 数値スキーマ + スキーマを満たす値                 | 値をそのまま返す（parse成功）                          |
 * | T-02 | 数値スキーマ + スキーマを満たさない値             | ZodError を投げる（parse失敗）                          |
 * | T-03 | オブジェクトスキーマ + 満たす値                   | パース結果のオブジェクトを返す                          |
 * | T-04 | transform を持つスキーマ + 満たす値               | schema.parse による変換後の値を返す                     |
 * | T-05 | 同一スキーマから生成した2つのバリデータ            | それぞれ独立して動作する（クロージャの独立性）           |
 */
describe('makeValidator', () => {
    it('[T-01] 数値スキーマ・valid値: 値をそのまま返す', () => {
        const schema = z.number().positive();
        const validate = makeValidator(schema);

        const result = validate(5);

        expect(result).toBe(5);
    });

    it('[T-02] 数値スキーマ・invalid値: ZodErrorを投げる', () => {
        const schema = z.number().positive('距離は0よりも大きい必要があります');
        const validate = makeValidator(schema);

        expect(() => validate(-1)).toThrow(z.ZodError);
    });

    it('[T-03] オブジェクトスキーマ・valid値: パース結果のオブジェクトを返す', () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const validate = makeValidator(schema);

        const result = validate({ name: 'Alice', age: 30 });

        expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('[T-04] transformを持つスキーマ: 変換後の値を返す', () => {
        const schema = z.string().transform((value) => value.toUpperCase());
        const validate = makeValidator(schema);

        const result = validate('abc');

        expect(result).toBe('ABC');
    });

    it('[T-05] 同一スキーマから生成した2つのバリデータ: 独立して動作する', () => {
        const schema = z.number().positive();
        const validateA = makeValidator(schema);
        const validateB = makeValidator(schema);

        const resultA = validateA(1);

        expect(resultA).toBe(1);
        expect(() => validateB(-1)).toThrow(z.ZodError);
    });
});
