/**
 * dateRange.ts (computeScheduledDateRange) UT
 *
 * `.github/workflows/batch-all.yml` の `set-dates` ジョブ（schedule実行時）
 * と同じ日付レンジ計算を再現できているかを検証する。
 *
 * ## デシジョンテーブル
 *
 * | #    | 検証内容                                        | 期待結果                         |
 * |------|--------------------------------------------------|-----------------------------------|
 * | T-01 | startDate = 基準日の前日                          | 基準日-1日                        |
 * | T-02 | finishDate = 基準日の翌日                         | 基準日+1日                        |
 * | T-03 | calendarFinishDate = 基準日+4日                   | 基準日+4日                        |
 * | T-04 | raceFinishDateFor(非NAR) = 基準日+2日             | JRA/KEIRIN/AUTORACE/BOATRACE/OVERSEASで基準日+2日 |
 * | T-05 | raceFinishDateFor(NAR) = 基準日+4日               | 基準日+4日                        |
 * | T-06 | 月末をまたぐ場合も正しく繰り上がる                | 2026-01-31基準で計算しても破綻しない |
 *
 * ### buildFixedDateRange（CICD-73/CONC-03: 手動トリガー統合）
 * | #    | 検証内容                                          | 期待結果                         |
 * |------|----------------------------------------------------|-----------------------------------|
 * | F-01 | startDate/finishDateがそのまま反映される           | 指定値と一致                      |
 * | F-02 | calendarFinishDate/raceFinishDateForも拡張されずfinishDateと同じ | 全てfinishDateと同じ値 |
 */

import { describe, expect, it } from 'bun:test';
import { RaceType } from '@race-schedule/core';

import {
    buildFixedDateRange,
    computeScheduledDateRange,
} from '../../../src/workflows/dateRange';

describe('computeScheduledDateRange', () => {
    it('T-01_startDateは基準日の前日になる', () => {
        // Arrange
        const now = new Date('2026-08-15T00:00:00+09:00');

        // Act
        const result = computeScheduledDateRange(now);

        // Assert
        expect(result.startDate).toBe('2026-08-14');
    });

    it('T-02_finishDateは基準日の翌日になる', () => {
        // Arrange
        const now = new Date('2026-08-15T00:00:00+09:00');

        // Act
        const result = computeScheduledDateRange(now);

        // Assert
        expect(result.finishDate).toBe('2026-08-16');
    });

    it('T-03_calendarFinishDateは基準日の4日後になる', () => {
        // Arrange
        const now = new Date('2026-08-15T00:00:00+09:00');

        // Act
        const result = computeScheduledDateRange(now);

        // Assert
        expect(result.calendarFinishDate).toBe('2026-08-19');
    });

    const nonNarRaceTypes = [
        RaceType.JRA,
        RaceType.KEIRIN,
        RaceType.AUTORACE,
        RaceType.BOATRACE,
        RaceType.OVERSEAS,
    ] as const;

    it.each(nonNarRaceTypes.map((raceType) => [raceType] as const))(
        'T-04_raceFinishDateForは非NAR(%s)で基準日の2日後になる',
        (raceType) => {
            // Arrange
            const now = new Date('2026-08-15T00:00:00+09:00');
            const result = computeScheduledDateRange(now);

            // Act
            const raceFinishDate = result.raceFinishDateFor(raceType);

            // Assert
            expect(raceFinishDate).toBe('2026-08-17');
        },
    );

    it('T-05_raceFinishDateForはNARで基準日の4日後になる', () => {
        // Arrange
        const now = new Date('2026-08-15T00:00:00+09:00');
        const result = computeScheduledDateRange(now);

        // Act
        const raceFinishDate = result.raceFinishDateFor(RaceType.NAR);

        // Assert
        expect(raceFinishDate).toBe('2026-08-19');
    });

    it('T-06_月末をまたぐ場合も正しく繰り上がる', () => {
        // Arrange
        const now = new Date('2026-01-31T00:00:00+09:00');

        // Act
        const result = computeScheduledDateRange(now);

        // Assert
        expect(result.startDate).toBe('2026-01-30');
        expect(result.finishDate).toBe('2026-02-01');
        expect(result.calendarFinishDate).toBe('2026-02-04');
    });
});

describe('buildFixedDateRange', () => {
    it('F-01_startDate_finishDateがそのまま反映される', () => {
        // Act
        const result = buildFixedDateRange('2026-09-01', '2026-09-02');

        // Assert
        expect(result.startDate).toBe('2026-09-01');
        expect(result.finishDate).toBe('2026-09-02');
    });

    it('F-02_calendarFinishDateとraceFinishDateForは拡張されずfinishDateと同じになる', () => {
        // Act
        const result = buildFixedDateRange('2026-09-01', '2026-09-02');

        // Assert
        expect(result.calendarFinishDate).toBe('2026-09-02');
        expect(result.raceFinishDateFor(RaceType.NAR)).toBe('2026-09-02');
        expect(result.raceFinishDateFor(RaceType.JRA)).toBe('2026-09-02');
    });
});
