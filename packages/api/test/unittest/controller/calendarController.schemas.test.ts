/**
 * calendarController.schemas テスト
 *
 * ## デシジョンテーブル（CalendarFlagAddRequestSchema）
 *
 * | #    | raceId       | label     | 期待結果 |
 * |------|--------------|-----------|----------|
 * | T-05 | 文字列あり   | 省略      | success（labelはundefined）|
 * | T-06 | 文字列あり   | 文字列あり| success  |
 * | T-07 | 数値（不正） | -         | failure  |
 * | T-10 | 文字列あり   | 201文字   | failure  |
 *
 * ## デシジョンテーブル（CalendarFlagRemoveRequestSchema）
 *
 * | #    | raceId       | 期待結果 |
 * |------|--------------|----------|
 * | T-08 | 文字列あり   | success  |
 * | T-09 | 数値（不正） | failure  |
 */
import { describe, expect, it } from 'bun:test';

import {
    CalendarFlagAddRequestSchema,
    CalendarFlagRemoveRequestSchema,
} from '../../../src/controller/calendarController.schemas';

describe('CalendarFlagAddRequestSchema', () => {
    // T-05: label省略 → success（undefined）
    it('CalendarFlagAddRequestSchema_labelを省略_successしlabelがundefinedであること', () => {
        // Act
        const result = CalendarFlagAddRequestSchema.safeParse({
            raceId: 'jra202501050101',
        });

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.label).toBeUndefined();
        }
    });

    // T-06: label指定あり → success
    it('CalendarFlagAddRequestSchema_labelを指定_successすること', () => {
        // Act
        const result = CalendarFlagAddRequestSchema.safeParse({
            raceId: 'jra202501050101',
            label: 'マイレース',
        });

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.label).toBe('マイレース');
        }
    });

    // T-07: raceIdが数値 → failure
    it('CalendarFlagAddRequestSchema_raceIdが数値_failureすること', () => {
        // Act
        const result = CalendarFlagAddRequestSchema.safeParse({
            raceId: 12345,
        });

        // Assert
        expect(result.success).toBe(false);
    });

    // T-10: labelが201文字 → failure
    it('CalendarFlagAddRequestSchema_labelが201文字_failureすること', () => {
        // Act
        const result = CalendarFlagAddRequestSchema.safeParse({
            raceId: 'jra202501050101',
            label: 'あ'.repeat(201),
        });

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('CalendarFlagRemoveRequestSchema', () => {
    // T-08: raceIdが文字列 → success
    it('CalendarFlagRemoveRequestSchema_raceIdが文字列_successすること', () => {
        // Act
        const result = CalendarFlagRemoveRequestSchema.safeParse({
            raceId: 'jra202501050101',
        });

        // Assert
        expect(result.success).toBe(true);
    });

    // T-09: raceIdが数値 → failure
    it('CalendarFlagRemoveRequestSchema_raceIdが数値_failureすること', () => {
        // Act
        const result = CalendarFlagRemoveRequestSchema.safeParse({
            raceId: 12345,
        });

        // Assert
        expect(result.success).toBe(false);
    });
});
