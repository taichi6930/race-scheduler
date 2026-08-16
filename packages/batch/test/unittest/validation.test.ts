/**
 * validation.ts (getMaxRangeDays) UT
 *
 * ## デシジョンテーブル（getMaxRangeDays）
 *
 * | #    | target       | raceType        | 期待結果 |
 * |------|--------------|-----------------|----------|
 * | T-01 | 'place'      | 任意（JRA）     | 390      |
 * | T-02 | 'place'      | 任意（NAR）     | 390      |
 * | T-03 | 'race'       | JRA             | 35       |
 * | T-04 | 'race'       | OVERSEAS        | 390      |
 * | T-05 | 'race'       | NAR（その他）   | 10       |
 * | T-06 | 'race'       | KEIRIN（その他）| 10       |
 * | T-07 | 'calendar'   | NAR（その他）   | 390（raceType不問）|
 * | T-08 | 'calendar'   | JRA             | 390（raceType不問）|
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import type { BatchTarget } from '../../src/types';
import { getMaxRangeDays } from '../../src/validation';

describe('getMaxRangeDays', () => {
    it('T-01_targetがplace_JRAでも390を返す', () => {
        // Arrange
        const target: BatchTarget = 'place';

        // Act
        const result = getMaxRangeDays(target, RaceType.JRA);

        // Assert
        expect(result).toBe(390);
    });

    it('T-02_targetがplace_NARでも390を返す', () => {
        // Arrange
        const target: BatchTarget = 'place';

        // Act
        const result = getMaxRangeDays(target, RaceType.NAR);

        // Assert
        expect(result).toBe(390);
    });

    it('T-03_targetがrace_JRA_35を返す', () => {
        // Arrange
        const target: BatchTarget = 'race';

        // Act
        const result = getMaxRangeDays(target, RaceType.JRA);

        // Assert
        expect(result).toBe(35);
    });

    it('T-04_targetがrace_OVERSEAS_390を返す', () => {
        // Arrange
        const target: BatchTarget = 'race';

        // Act
        const result = getMaxRangeDays(target, RaceType.OVERSEAS);

        // Assert
        expect(result).toBe(390);
    });

    it('T-05_targetがrace_NAR_35を返す', () => {
        // Arrange: NARは月間ZIP1本に集約されており日数を延ばしても
        // 外部サイトへの負荷が増えないため、JRAと同じ35日
        const target: BatchTarget = 'race';

        // Act
        const result = getMaxRangeDays(target, RaceType.NAR);

        // Assert
        expect(result).toBe(35);
    });

    it('T-06_targetがrace_KEIRIN_10を返す', () => {
        // Arrange
        const target: BatchTarget = 'race';

        // Act
        const result = getMaxRangeDays(target, RaceType.KEIRIN);

        // Assert
        expect(result).toBe(10);
    });

    it('T-07_targetがcalendar_NARでもraceTypeによらず390を返す', () => {
        // Arrange
        const target: BatchTarget = 'calendar';

        // Act
        const result = getMaxRangeDays(target, RaceType.NAR);

        // Assert
        expect(result).toBe(390);
    });

    it('T-08_targetがcalendar_JRAでもraceTypeによらず390を返す', () => {
        // Arrange
        const target: BatchTarget = 'calendar';

        // Act
        const result = getMaxRangeDays(target, RaceType.JRA);

        // Assert
        expect(result).toBe(390);
    });
});
