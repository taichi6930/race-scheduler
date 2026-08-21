/**
 * schemas/upsertResultSchema テスト
 *
 * ## デシジョンテーブル: upsertResultSchema
 *
 * | #    | 入力                                                    | 期待結果      |
 * |------|-----------------------------------------------------------|---------------|
 * | T-01 | 正常形状（successCount/failureCount/failures）             | success:true  |
 * | T-02 | failuresが空配列                                          | success:true  |
 * | T-03 | successCountが文字列（型不一致）                          | success:false |
 * | T-04 | failuresが配列でない（型不一致）                          | success:false |
 * | T-05 | failures内の要素がfailureDetailSchemaに適合しない          | success:false |
 *
 * ## デシジョンテーブル: calendarUpsertResultSchema
 *
 * | #    | 入力                                                    | 期待結果      |
 * |------|-----------------------------------------------------------|---------------|
 * | T-06 | 正常形状（全カウント + failures）                          | success:true  |
 * | T-07 | insertedCountが欠落                                       | success:false |
 * | T-08 | failuresに正しい形状の要素あり（id/reason）                | success:true  |
 * | T-09 | failures要素のreasonが欠落                                | success:false |
 */

import { describe, expect, it } from 'bun:test';

import {
    calendarUpsertResultSchema,
    upsertResultSchema,
} from '../../../src/schemas/upsertResultSchema';

describe('schemas/upsertResultSchema', () => {
    it('T-01: 正常形状の場合パースに成功すること', () => {
        const result = upsertResultSchema.safeParse({
            successCount: 2,
            failureCount: 1,
            failures: [{ db: 'race', id: 'r1', reason: 'validation error' }],
        });

        expect(result.success).toBe(true);
    });

    it('T-02: failuresが空配列の場合パースに成功すること', () => {
        const result = upsertResultSchema.safeParse({
            successCount: 3,
            failureCount: 0,
            failures: [],
        });

        expect(result.success).toBe(true);
    });

    it('T-03: successCountが文字列の場合パースに失敗すること', () => {
        const result = upsertResultSchema.safeParse({
            successCount: '2',
            failureCount: 1,
            failures: [],
        });

        expect(result.success).toBe(false);
    });

    it('T-04: failuresが配列でない場合パースに失敗すること', () => {
        const result = upsertResultSchema.safeParse({
            successCount: 2,
            failureCount: 1,
            failures: 'not-an-array',
        });

        expect(result.success).toBe(false);
    });

    it('T-05: failures内の要素がfailureDetailSchemaに適合しない場合パースに失敗すること', () => {
        const result = upsertResultSchema.safeParse({
            successCount: 2,
            failureCount: 1,
            failures: [{ db: 'race', reason: 'missing id field' }],
        });

        expect(result.success).toBe(false);
    });
});

describe('schemas/calendarUpsertResultSchema', () => {
    it('T-06: 正常形状の場合パースに成功すること', () => {
        const result = calendarUpsertResultSchema.safeParse({
            successCount: 5,
            insertedCount: 2,
            updatedCount: 2,
            deletedCount: 1,
            failureCount: 0,
            failures: [],
        });

        expect(result.success).toBe(true);
    });

    it('T-07: insertedCountが欠落している場合パースに失敗すること', () => {
        const result = calendarUpsertResultSchema.safeParse({
            successCount: 5,
            updatedCount: 2,
            deletedCount: 1,
            failureCount: 0,
            failures: [],
        });

        expect(result.success).toBe(false);
    });

    it('T-08: failuresに正しい形状の要素（id/reason）がある場合パースに成功すること', () => {
        const result = calendarUpsertResultSchema.safeParse({
            successCount: 4,
            insertedCount: 1,
            updatedCount: 2,
            deletedCount: 1,
            failureCount: 1,
            failures: [{ id: 'race-1', reason: 'sync failed' }],
        });

        expect(result.success).toBe(true);
    });

    it('T-09: failures要素のreasonが欠落している場合パースに失敗すること', () => {
        const result = calendarUpsertResultSchema.safeParse({
            successCount: 4,
            insertedCount: 1,
            updatedCount: 2,
            deletedCount: 1,
            failureCount: 1,
            failures: [{ id: 'race-1' }],
        });

        expect(result.success).toBe(false);
    });
});
