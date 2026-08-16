/**
 * createEmptyCalendarUpsertResult のテスト
 *
 * ## デシジョンテーブル
 * | # | 条件                              | 期待結果                                        |
 * |---|-----------------------------------|--------------------------------------------------|
 * | 1 | createEmptyCalendarUpsertResult() | 全カウント0・failures空配列のオブジェクトを返す |
 * | 2 | 2回連続で呼び出す                | 互いに独立したオブジェクト（参照を共有しない）  |
 */

import { describe, expect, it } from 'bun:test';

import { createEmptyCalendarUpsertResult } from '../../../src/dto/calendarUpsertResult';

describe('createEmptyCalendarUpsertResult', () => {
    it('全カウントが0でfailuresが空配列のオブジェクトを返す', () => {
        const result = createEmptyCalendarUpsertResult();

        expect(result).toEqual({
            successCount: 0,
            insertedCount: 0,
            updatedCount: 0,
            deletedCount: 0,
            failureCount: 0,
            failures: [],
        });
    });

    it('呼び出すたびに新しいオブジェクトを返す（参照共有しない）', () => {
        const first = createEmptyCalendarUpsertResult();
        const second = createEmptyCalendarUpsertResult();

        first.failures.push({ id: 'x', reason: 'y' });

        expect(second.failures).toEqual([]);
    });
});
