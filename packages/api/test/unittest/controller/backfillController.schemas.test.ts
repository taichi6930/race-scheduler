/**
 * backfillController.schemas テスト
 *
 * ## デシジョンテーブル（BackfillRequestBodySchema）
 *
 * | #   | startDate/finishDate/raceTypeList | 期待結果 |
 * |-----|-------------------------------------|----------|
 * | T-01 | 全て正常                           | success  |
 * | T-02 | raceTypeListが空配列                | failure  |
 * | T-03 | raceTypeListに無効な値              | failure  |
 * | T-04 | startDate > finishDate              | failure  |
 * | T-05 | 日付レンジが上限(400日)を超過        | failure  |
 * | T-06 | 日付レンジが上限(400日)ちょうど      | success  |
 */
import { describe, expect, it } from 'bun:test';

import { BackfillRequestBodySchema } from '../../../src/controller/backfillController.schemas';

describe('BackfillRequestBodySchema', () => {
    it('T-01: 全て正常な値の場合successすること', () => {
        const result = BackfillRequestBodySchema.safeParse({
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: ['keirin'],
        });

        expect(result.success).toBe(true);
    });

    it('T-02: raceTypeListが空配列の場合failureすること', () => {
        const result = BackfillRequestBodySchema.safeParse({
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: [],
        });

        expect(result.success).toBe(false);
    });

    it('T-03: raceTypeListに無効な値が含まれる場合failureすること', () => {
        const result = BackfillRequestBodySchema.safeParse({
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: ['invalid-race-type'],
        });

        expect(result.success).toBe(false);
    });

    it('T-04: startDateがfinishDateを超える場合failureすること', () => {
        const result = BackfillRequestBodySchema.safeParse({
            startDate: '2026-02-01',
            finishDate: '2026-01-01',
            raceTypeList: ['keirin'],
        });

        expect(result.success).toBe(false);
    });

    it('T-05: 日付レンジが上限(400日)を超過する場合failureすること', () => {
        const result = BackfillRequestBodySchema.safeParse({
            startDate: '2026-01-01',
            finishDate: '2027-02-06', // 401日
            raceTypeList: ['keirin'],
        });

        expect(result.success).toBe(false);
    });

    it('T-06: 日付レンジが上限(400日)ちょうどの場合successすること', () => {
        const result = BackfillRequestBodySchema.safeParse({
            startDate: '2026-01-01',
            finishDate: '2027-02-05', // 400日
            raceTypeList: ['keirin'],
        });

        expect(result.success).toBe(true);
    });
});
