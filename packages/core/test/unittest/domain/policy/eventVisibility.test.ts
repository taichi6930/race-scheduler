/**
 * domain/policy/eventVisibility テスト
 *
 * ## デシジョンテーブル: shouldDisplayCalendarEvent
 *
 * | #    | eventDate     | status    | 期待結果 |
 * |------|---------------|-----------|----------|
 * | T-01 | today以前     | predicted | false    |
 * | T-02 | today以前     | confirmed | true     |
 * | T-03 | today以前     | 無印      | true     |
 * | T-04 | tomorrow      | predicted | false    |
 * | T-05 | tomorrow      | confirmed | true     |
 * | T-06 | tomorrow      | 無印      | false    |
 * | T-07 | afterTomorrow | predicted | true     |
 * | T-08 | tomorrowとafterTomorrowの間（未満） | predicted | false |
 *
 * ## デシジョンテーブル: isCalendarEventDeleteTarget
 *
 * | #    | eventDate | status    | 期待結果 |
 * |------|-----------|-----------|----------|
 * | T-09 | today以前 | predicted | true     |
 * | T-10 | today以前 | confirmed | false    |
 * | T-11 | tomorrow  | predicted | true     |
 * | T-12 | tomorrow  | 無印      | true     |
 * | T-13 | tomorrow  | confirmed | false    |
 * | T-14 | afterTomorrow以降 | predicted | false |
 */

import { describe, expect, it } from 'bun:test';

import {
    isCalendarEventDeleteTarget,
    shouldDisplayCalendarEvent,
} from '../../../../src/domain/policy/eventVisibility';

const TODAY = '2026-01-10';
const TOMORROW = '2026-01-11';
const AFTER_TOMORROW = '2026-01-12';

describe('shouldDisplayCalendarEvent', () => {
    it('T-01_today以前かつpredicted_falseを返す', () => {
        // Arrange & Act
        const result = shouldDisplayCalendarEvent(
            TODAY,
            'predicted',
            TODAY,
            TOMORROW,
            AFTER_TOMORROW,
        );

        // Assert
        expect(result).toBe(false);
    });

    it('T-02_today以前かつconfirmed_trueを返す', () => {
        // Arrange & Act
        const result = shouldDisplayCalendarEvent(
            TODAY,
            'confirmed',
            TODAY,
            TOMORROW,
            AFTER_TOMORROW,
        );

        // Assert
        expect(result).toBe(true);
    });

    it('T-03_today以前かつ無印_trueを返す', () => {
        // Arrange & Act
        const result = shouldDisplayCalendarEvent(
            TODAY,
            '',
            TODAY,
            TOMORROW,
            AFTER_TOMORROW,
        );

        // Assert
        expect(result).toBe(true);
    });

    it('T-04_tomorrowかつpredicted_falseを返す', () => {
        // Arrange & Act
        const result = shouldDisplayCalendarEvent(
            TOMORROW,
            'predicted',
            TODAY,
            TOMORROW,
            AFTER_TOMORROW,
        );

        // Assert
        expect(result).toBe(false);
    });

    it('T-05_tomorrowかつconfirmed_trueを返す', () => {
        // Arrange & Act
        const result = shouldDisplayCalendarEvent(
            TOMORROW,
            'confirmed',
            TODAY,
            TOMORROW,
            AFTER_TOMORROW,
        );

        // Assert
        expect(result).toBe(true);
    });

    it('T-06_tomorrowかつ無印_falseを返す', () => {
        // Arrange & Act
        const result = shouldDisplayCalendarEvent(
            TOMORROW,
            '',
            TODAY,
            TOMORROW,
            AFTER_TOMORROW,
        );

        // Assert
        expect(result).toBe(false);
    });

    it('T-07_afterTomorrow以降かつpredicted_trueを返す', () => {
        // Arrange & Act
        const result = shouldDisplayCalendarEvent(
            AFTER_TOMORROW,
            'predicted',
            TODAY,
            TOMORROW,
            AFTER_TOMORROW,
        );

        // Assert
        expect(result).toBe(true);
    });

    it('T-08_tomorrowとafterTomorrowの間（未満）_falseを返す', () => {
        // Arrange
        // tomorrowより後・afterTomorrowより前の日付（境界: afterTomorrow未満）
        const beforeAfterTomorrow = '2026-01-11T12:00'; // tomorrowと文字列比較でtomorrowより大きいがafterTomorrow未満

        // Act
        const result = shouldDisplayCalendarEvent(
            beforeAfterTomorrow,
            'predicted',
            TODAY,
            TOMORROW,
            AFTER_TOMORROW,
        );

        // Assert
        expect(result).toBe(false);
    });
});

describe('isCalendarEventDeleteTarget', () => {
    it('T-09_today以前かつpredicted_trueを返す', () => {
        // Arrange & Act
        const result = isCalendarEventDeleteTarget(
            TODAY,
            'predicted',
            TODAY,
            TOMORROW,
        );

        // Assert
        expect(result).toBe(true);
    });

    it('T-10_today以前かつconfirmed_falseを返す', () => {
        // Arrange & Act
        const result = isCalendarEventDeleteTarget(
            TODAY,
            'confirmed',
            TODAY,
            TOMORROW,
        );

        // Assert
        expect(result).toBe(false);
    });

    it('T-11_tomorrowかつpredicted_trueを返す', () => {
        // Arrange & Act
        const result = isCalendarEventDeleteTarget(
            TOMORROW,
            'predicted',
            TODAY,
            TOMORROW,
        );

        // Assert
        expect(result).toBe(true);
    });

    it('T-12_tomorrowかつ無印_trueを返す', () => {
        // Arrange & Act
        const result = isCalendarEventDeleteTarget(
            TOMORROW,
            '',
            TODAY,
            TOMORROW,
        );

        // Assert
        expect(result).toBe(true);
    });

    it('T-13_tomorrowかつconfirmed_falseを返す', () => {
        // Arrange & Act
        const result = isCalendarEventDeleteTarget(
            TOMORROW,
            'confirmed',
            TODAY,
            TOMORROW,
        );

        // Assert
        expect(result).toBe(false);
    });

    it('T-14_afterTomorrow以降かつpredicted_falseを返す', () => {
        // Arrange & Act
        const result = isCalendarEventDeleteTarget(
            AFTER_TOMORROW,
            'predicted',
            TODAY,
            TOMORROW,
        );

        // Assert
        expect(result).toBe(false);
    });
});
