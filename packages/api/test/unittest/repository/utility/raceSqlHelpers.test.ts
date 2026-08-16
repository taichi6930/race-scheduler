/**
 * raceSqlHelpers.test.ts - toRaceInsertRow のユニットテスト
 *
 * @remarks
 * Issue #2484: `raceRepository.ts` の `RACE_INSERT_PARAMS_PER_ROW`
 * （チャンクサイズ算出用の手書き定数）が `toRaceInsertRow` の実際の列数と
 * 食い違い（8 vs 実際の9）、D1のバインド変数上限(100)を超えて
 * `race` upsert が軒並み失敗していた。この手書き定数と実列数の一致は
 * 機械的に強制できないため、実列数を明示的にテストで固定し、将来
 * 列が増減した際に「テストを見て定数を更新し忘れていないか」に
 * 気付ける最小のガードにする。
 *
 * ## デシジョンテーブル
 * | # | 対象 | 期待結果 |
 * |---|------|----------|
 * | T-01 | toRaceInsertRow の返すオブジェクト | キー数が9（raceRepository.ts の RACE_INSERT_PARAMS_PER_ROW と一致させること） |
 */

import { describe, expect, it } from 'bun:test';
import type { RaceEntity } from '@race-schedule/core';
import {
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';

import { toRaceInsertRow } from '../../../../src/repository/utility/raceSqlHelpers';

const JRA_ENTITY: RaceEntity = {
    raceId: validateRaceId('jra202501010501'),
    placeId: validatePlaceId('jra2025010105'),
    raceType: RaceType.JRA,
    datetime: new Date('2025-01-01T00:00:00Z'),
    raceName: '有馬記念',
    raceNumber: 1,
    raceCourse: '東京',
    locationCode: validateLocationCode('05'),
    raceGrade: 'GⅠ',
    conditionData: { surfaceType: '芝', distance: 2000 },
    placeHeldDays: { heldTimes: 3, heldDayTimes: 1 },
};

describe('toRaceInsertRow', () => {
    it('T-01_列数が9であること_raceRepositoryのRACE_INSERT_PARAMS_PER_ROWと一致させること', () => {
        // Arrange & Act
        const row = toRaceInsertRow(JRA_ENTITY);

        // Assert
        expect(Object.keys(row)).toHaveLength(9);
    });
});
