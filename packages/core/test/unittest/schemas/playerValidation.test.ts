/**
 * schemas/playerValidation テスト
 *
 * ## デシジョンテーブル
 *
 * ### parsePlayerEntityUpsert
 * | # | Input | 期待結果 | Coverage |
 * |----|-------|----------|----------|
 * | 1  | 単一のプレイヤーオブジェクト | 1要素のPlayerEntity配列を返す | Line |
 * | 2  | プレイヤーオブジェクトの配列 | 同数のPlayerEntity配列を返す | Branch |
 * | 3  | player_no が数値 | 文字列に変換される | Branch |
 * | 4  | 必須フィールド欠如 | ValidationError | Branch |
 * | 5  | 空配列 | ValidationError | Branch |
 * | 6  | priority が小数点 | ValidationError | Branch |
 *
 * ### resolvePlayerValidationMessage
 * | # | Input | 期待結果 | Coverage |
 * |----|-------|----------|----------|
 * | 7  | issues=[]（空配列） | 'Invalid request body' | Branch |
 */

import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@race-schedule/core';

import {
    parsePlayerEntityUpsert,
    resolvePlayerValidationMessage,
} from '../../../src/schemas/playerValidation';

const validPlayer = {
    race_type: 'keirin',
    player_no: '123',
    player_name: '山田太郎',
    priority: 1,
};

describe('parsePlayerEntityUpsert', () => {
    it('#1: 単一のプレイヤーオブジェクトを1要素のPlayerEntity配列として返す', () => {
        const result = parsePlayerEntityUpsert(validPlayer);

        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1);
        expect(result[0].playerName).toBe('山田太郎');
    });

    it('#2: プレイヤーオブジェクトの配列を同数のPlayerEntity配列として返す', () => {
        const input = [validPlayer, { ...validPlayer, player_no: '456' }];

        const result = parsePlayerEntityUpsert(input);

        expect(result).toHaveLength(2);
    });

    it('#3: player_noが数値の場合は文字列に変換される', () => {
        const input = { ...validPlayer, player_no: 123 };

        const result = parsePlayerEntityUpsert(input);

        expect(result[0].playerNo).toBe('123');
        expect(typeof result[0].playerNo).toBe('string');
    });

    it('#4: 必須フィールドが欠如している場合はValidationErrorを投げる', () => {
        const input = { player_no: '123', priority: 1 };

        expect(() => parsePlayerEntityUpsert(input)).toThrow(ValidationError);
    });

    it('#5: 空配列の場合はValidationErrorを投げる（place/raceのupsertスキーマと同様、1件以上必須）', () => {
        expect(() => parsePlayerEntityUpsert([])).toThrow(ValidationError);
    });

    it('#6: priorityが整数でない場合はValidationErrorを投げる', () => {
        const input = { ...validPlayer, priority: 1.5 };

        expect(() => parsePlayerEntityUpsert(input)).toThrow(ValidationError);
    });

    it('player_nameが空文字の場合はValidationErrorを投げる', () => {
        const input = { ...validPlayer, player_name: '' };

        expect(() => parsePlayerEntityUpsert(input)).toThrow(ValidationError);
    });

    it('race_typeが空文字の場合はValidationErrorを投げる', () => {
        const input = { ...validPlayer, race_type: '' };

        expect(() => parsePlayerEntityUpsert(input)).toThrow(ValidationError);
    });

    it('race_typeが未知の値の場合はValidationErrorを投げる', () => {
        const input = { ...validPlayer, race_type: 'unknown_type' };

        expect(() => parsePlayerEntityUpsert(input)).toThrow(ValidationError);
    });

    it('priorityが文字列数値の場合は数値に変換される', () => {
        const input = { ...validPlayer, priority: '5' };

        const result = parsePlayerEntityUpsert(input);

        expect(result[0].priority).toBe(5);
    });

    it('ValidationErrorのstatusが400であること', () => {
        try {
            parsePlayerEntityUpsert({});
            throw new Error('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as ValidationError).status).toBe(400);
        }
    });

    it('予期しないフィールドがある場合はValidationErrorを投げる', () => {
        const input = { ...validPlayer, extra_field: 'unexpected' };

        expect(() => parsePlayerEntityUpsert(input)).toThrow(ValidationError);
    });
});

describe('resolvePlayerValidationMessage', () => {
    it('#7: issuesが空配列の場合はInvalid request bodyを返す', () => {
        // Arrange & Act
        // 通常のzod検証失敗では issues は常に1件以上を持つため、この分岐は
        // parsePlayerEntityUpsert経由では到達できない防御的な既定値。
        const result = resolvePlayerValidationMessage([]);

        // Assert
        expect(result).toBe('Invalid request body');
    });
});
