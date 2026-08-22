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
 * | T-02 | toRaceInsertRow（datetimeが文字列） | dateTimeがそのまま返る（Dateインスタンスでない場合の分岐） |
 * | T-03 | toRaceInsertRow（isConfirmed: false） | isConfirmedが0 |
 * | T-04 | buildRaceWhereConditions（includeRaceStage省略） | 既定値falseとして扱われ、条件配列の末尾がundefinedになる |
 */

import { describe, expect, it } from 'bun:test';
import type { RaceEntity } from '@race-schedule/core';
import {
    RaceType,
    validateLocationCode,
    validatePlaceId,
    validateRaceId,
} from '@race-schedule/core';

import {
    buildRaceWhereConditions,
    toRaceInsertRow,
} from '../../../../src/repository/utility/raceSqlHelpers';

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

    it('T-02_datetimeが文字列のときそのままdateTimeへ渡ること', () => {
        // Arrange
        // NOTE: datetimeがDateインスタンスでない（レガシー/生DB由来の文字列）ケースは
        // 型定義上あり得ないが、toRaceInsertRow実装が防御的に分岐しているため、
        // 意図的に型を破って検証する（`unknown`経由の変換はoxlint anti-slopの
        // no-chained-type-assertions対象だが、現状は導入初期のためwarn運用）
        const entity = {
            ...JRA_ENTITY,
            datetime: '2025-01-01T09:00:00+09:00',
        } as unknown as RaceEntity;

        // Act
        const row = toRaceInsertRow(entity);

        // Assert
        expect(row.dateTime).toBe('2025-01-01T09:00:00+09:00');
    });

    it('T-03_isConfirmedがfalseのとき明示的に0へマッピングすること', () => {
        // Arrange
        const entity: RaceEntity = { ...JRA_ENTITY, isConfirmed: false };

        // Act
        const row = toRaceInsertRow(entity);

        // Assert
        expect(row.isConfirmed).toBe(0);
    });
});

describe('buildRaceWhereConditions', () => {
    const BASE_PARAMS = {
        startDate: new Date('2025-01-01'),
        finishDate: new Date('2025-01-31'),
        raceTypeList: [],
        locationList: [],
        gradeList: [],
    };

    it('T-04_includeRaceStageを省略したとき既定値falseとして条件末尾がundefinedになること', () => {
        // Arrange & Act（第4引数を省略してデフォルト値のパスを通す）
        const conditions = buildRaceWhereConditions(
            BASE_PARAMS,
            BASE_PARAMS.finishDate,
            true,
        );

        // Assert
        expect(conditions.at(-1)).toBeUndefined();
    });
});
