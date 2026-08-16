/**
 * domain/service/heldDays テスト
 *
 * ## デシジョンテーブル: accumulateHeldDayTimes
 *
 * | #    | 呼び出し順序                              | 期待される戻り値の並び |
 * |------|--------------------------------------------|-------------------------|
 * | T-01 | 新規place・新規heldTimesを1回呼ぶ          | 1                       |
 * | T-02 | 同一place・同一heldTimesを連続で複数回呼ぶ | 1, 2, 3                 |
 * | T-03 | 同一placeだがheldTimesが異なる             | それぞれ独立して1から始まる |
 * | T-04 | placeが異なる（heldTimesは同じ）          | それぞれ独立して1から始まる |
 * | T-05 | placeが'__proto__'                         | 通常のキーとして1を返す（プロトタイプ汚染しない） |
 */

import { describe, expect, it } from 'bun:test';

import type { HeldDayTimesCounter } from '../../../../src/domain/service/heldDays';
import { accumulateHeldDayTimes } from '../../../../src/domain/service/heldDays';

describe('accumulateHeldDayTimes', () => {
    it('T-01_新規のplace・heldTimesで初回呼び出し_1を返す', () => {
        // Arrange
        const counter: HeldDayTimesCounter = new Map();

        // Act
        const result = accumulateHeldDayTimes(counter, '東京', 3);

        // Assert
        expect(result).toBe(1);
    });

    it('T-02_同一place・heldTimesを複数回呼ぶ_呼ぶたびに1ずつ増加する', () => {
        // Arrange
        const counter: HeldDayTimesCounter = new Map();

        // Act
        const first = accumulateHeldDayTimes(counter, '東京', 3);
        const second = accumulateHeldDayTimes(counter, '東京', 3);
        const third = accumulateHeldDayTimes(counter, '東京', 3);

        // Assert
        expect([first, second, third]).toEqual([1, 2, 3]);
    });

    it('T-03_同一placeでheldTimesが異なる_それぞれ独立して1から始まる', () => {
        // Arrange
        const counter: HeldDayTimesCounter = new Map();

        // Act
        const race3 = accumulateHeldDayTimes(counter, '東京', 3);
        const race4 = accumulateHeldDayTimes(counter, '東京', 4);

        // Assert
        expect(race3).toBe(1);
        expect(race4).toBe(1);
    });

    it('T-04_placeが異なる_それぞれ独立して1から始まる', () => {
        // Arrange
        const counter: HeldDayTimesCounter = new Map();

        // Act
        const tokyo = accumulateHeldDayTimes(counter, '東京', 3);
        const nakayama = accumulateHeldDayTimes(counter, '中山', 3);

        // Assert
        expect(tokyo).toBe(1);
        expect(nakayama).toBe(1);
    });

    it("T-05_placeが'__proto__'_通常のキーとして扱いプロトタイプを汚染しない", () => {
        // Arrange
        const counter: HeldDayTimesCounter = new Map();

        // Act
        const result = accumulateHeldDayTimes(counter, '__proto__', 3);

        // Assert
        expect(result).toBe(1);
        expect(({} as Record<string, unknown>)[3]).toBeUndefined();
    });
});
