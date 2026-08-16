/**
 * formatEntities.test.ts - formatEntities のユニットテスト
 *
 * ## デシジョンテーブル（formatEntities）
 *
 * @remarks
 * PERF-045: 本モジュールは旧 `filterAndFormatEntities` から
 * locationList/gradeList によるJS側再フィルタ（SQL側と重複していた処理）を
 * 削除し、datetime文字列化とaugmentのみに責務を絞った。フィルタ自体の
 * デシジョンテーブル（L-01〜G-04相当）は repository層（raceRepository.test.ts /
 * placeRepository.test.ts）側でカバーする。
 *
 * ### datetime 変換
 * | #    | datetime 型  | 期待                          |
 * |------|--------------|-------------------------------|
 * | D-01 | Date         | toJstISOString で文字列化     |
 * | D-02 | string       | そのまま透過                  |
 *
 * ### augment（DTOへの追加フィールド合成）
 * | #    | augment      | 期待                              |
 * |------|--------------|-----------------------------------|
 * | A-01 | 未指定       | 追加フィールドなし（既存互換）    |
 * | A-02 | 指定あり     | 戻り値のDTOに追加フィールドが乗る |
 */
import 'reflect-metadata';

import { describe, expect, it } from 'bun:test';
import { toJstISOString } from '@race-schedule/core';

import { formatEntities } from '../../../../src/controller/utility/formatEntities';

interface SampleEntity {
    locationCode: string;
    datetime: Date | string;
    grade?: string;
}

const entity = (
    locationCode: string,
    datetime: Date | string,
    grade?: string,
): SampleEntity => ({ locationCode, datetime, grade });

describe('formatEntities', () => {
    // D-01
    it('formatEntities_datetimeがDate_toJstISOStringで文字列化すること', () => {
        // Arrange
        const date = new Date('2026-01-01T00:00:00Z');
        const entities = [entity('01', date, 'GⅠ')];

        // Act
        const result = formatEntities(entities);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0].datetime).toBe(toJstISOString(date));
        expect(result[0].locationCode).toBe('01');
    });

    // D-02
    it('formatEntities_datetimeが文字列_そのまま透過すること', () => {
        // Arrange
        const entities = [entity('01', '2026-01-01T09:00:00+09:00')];

        // Act
        const result = formatEntities(entities);

        // Assert
        expect(result[0].datetime).toBe('2026-01-01T09:00:00+09:00');
    });

    // A-01
    it('formatEntities_augment未指定_追加フィールドが乗らないこと', () => {
        // Arrange
        const entities = [entity('01', '2026-01-01T09:00:00+09:00', 'GⅠ')];

        // Act
        const result = formatEntities(entities);

        // Assert
        expect(result[0]).not.toHaveProperty('isCalendarSpecified');
    });

    // A-02
    it('formatEntities_augment指定_DTOに追加フィールドが合成されること', () => {
        // Arrange
        const entities = [entity('01', '2026-01-01T09:00:00+09:00', 'GⅠ')];
        const augment = (e: SampleEntity): Record<string, unknown> => ({
            isCalendarSpecified: e.grade === 'GⅠ',
        });

        // Act
        const result = formatEntities(entities, augment);

        // Assert
        expect(result[0].isCalendarSpecified).toBe(true);
    });
});
