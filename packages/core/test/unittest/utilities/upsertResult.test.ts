/**
 * upsertResult ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | createEmptyUpsertResult | なし | 初期状態を返す | Line |
 * | 2  | createEmptyUpsertResult | なし | successCount = 0 | Branch |
 * | 3  | createEmptyUpsertResult | なし | failureCount = 0 | Branch |
 * | 4  | createEmptyUpsertResult | なし | failures = [] | Branch |
 */

import { describe, expect, it } from 'bun:test';
import {
    createEmptyUpsertResult,
    type UpsertResult,
} from '@race-schedule/core';

describe('upsertResult', () => {
    describe('createEmptyUpsertResult', () => {
        it('空の UpsertResult オブジェクトを生成', () => {
            const result = createEmptyUpsertResult();

            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });

        it('successCount が 0 で初期化される', () => {
            const result = createEmptyUpsertResult();

            expect(result.successCount).toBe(0);
        });

        it('failureCount が 0 で初期化される', () => {
            const result = createEmptyUpsertResult();

            expect(result.failureCount).toBe(0);
        });

        it('failures が空配列で初期化される', () => {
            const result = createEmptyUpsertResult();

            expect(result.failures).toEqual([]);
            expect(result.failures.length).toBe(0);
        });

        it('各プロパティが正しい型で初期化される', () => {
            const result = createEmptyUpsertResult();

            expect(typeof result.successCount).toBe('number');
            expect(typeof result.failureCount).toBe('number');
            expect(Array.isArray(result.failures)).toBe(true);
        });

        it('返り値が UpsertResult 型である', () => {
            const result = createEmptyUpsertResult();

            expect('successCount' in result).toBe(true);
            expect('failureCount' in result).toBe(true);
            expect('failures' in result).toBe(true);
        });

        it('複数回呼び出しても独立した新しいオブジェクトが返される', () => {
            const result1 = createEmptyUpsertResult();
            const result2 = createEmptyUpsertResult();

            expect(result1).not.toBe(result2);
            expect(result1).toEqual(result2);
        });

        it('返された failures 配列は変更可能である', () => {
            const result = createEmptyUpsertResult();

            result.failures.push({
                db: 'test_table',
                id: '123',
                reason: 'Test failure',
            });

            expect(result.failures.length).toBe(1);
            expect(result.failures[0].db).toBe('test_table');
        });

        it('返された successCount は変更可能である', () => {
            const result = createEmptyUpsertResult();

            result.successCount = 5;

            expect(result.successCount).toBe(5);
        });

        it('返された failureCount は変更可能である', () => {
            const result = createEmptyUpsertResult();

            result.failureCount = 3;

            expect(result.failureCount).toBe(3);
        });

        it('初期状態の failures 配列は空である', () => {
            const result = createEmptyUpsertResult();

            expect(result.failures).toHaveLength(0);
            expect(result.failures).toEqual([]);
        });

        it('返り値の構造が一貫している', () => {
            const result = createEmptyUpsertResult();
            const expected: UpsertResult = {
                successCount: 0,
                failureCount: 0,
                failures: [],
            };

            expect(result).toEqual(expected);
        });
    });

    describe('UpsertResult 型インターフェース', () => {
        it('FailureDetail 構造を持つ failures 配列を保持できる', () => {
            const result = createEmptyUpsertResult();

            result.failures = [
                { db: 'users', id: '1', reason: 'Duplicate key' },
                { db: 'posts', id: '2', reason: 'Invalid data' },
            ];

            expect(result.failures.length).toBe(2);
            expect(result.failures[0]).toEqual({
                db: 'users',
                id: '1',
                reason: 'Duplicate key',
            });
        });

        it('数値型のカウント値を更新できる', () => {
            const result = createEmptyUpsertResult();

            result.successCount = 10;
            result.failureCount = 2;

            expect(result.successCount).toBe(10);
            expect(result.failureCount).toBe(2);
        });
    });
});
