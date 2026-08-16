import { describe, expect, it } from 'bun:test';
import { validateRaceId } from '../../../src/domain/model/valueObject/raceId';
import { validateCalendarFlagEntity } from '../../../src/entity/calendarFlagEntity';

/**
 * デシジョンテーブル: validateCalendarFlagEntity
 *
 * | # | raceId              | label      | 期待結果 |
 * |---|---------------------|------------|----------|
 * | 1 | 有効なraceId        | 文字列     | 成功     |
 * | 2 | 有効なraceId        | 空文字     | 成功     |
 * | 3 | raceId形式不正       | 文字列     | エラー   |
 * | 4 | raceId undefined     | 文字列     | エラー   |
 * | 5 | 有効なraceId        | undefined  | エラー   |
 */
describe('validateCalendarFlagEntity', () => {
    const validBase = {
        raceId: validateRaceId('nar202601010202'),
        label: '一口:テスト号',
    };

    it('有効なraceId・labelの場合はバリデーションが成功する', () => {
        const result = validateCalendarFlagEntity(validBase);
        expect(result).toEqual(validBase);
    });

    it('labelが空文字の場合もバリデーションが成功する', () => {
        const data = { ...validBase, label: '' };
        const result = validateCalendarFlagEntity(data);
        expect(result).toEqual(data);
    });

    it('raceIdの形式が不正な場合はエラーになる', () => {
        expect(() =>
            validateCalendarFlagEntity({
                ...validBase,
                raceId: 'invalid-race-id',
            }),
        ).toThrow();
    });

    it('raceIdがundefinedの場合はエラーになる', () => {
        const { raceId: _raceId, ...rest } = validBase;
        expect(() => validateCalendarFlagEntity(rest)).toThrow();
    });

    it('labelがundefinedの場合はエラーになる', () => {
        const { label: _label, ...rest } = validBase;
        expect(() => validateCalendarFlagEntity(rest)).toThrow();
    });
});
