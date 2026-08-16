import { describe, expect, it } from 'bun:test';
import { RaceType } from '../../../src/domain/model/valueObject/raceType';
import { validateCalendarDataEntity } from '../../../src/entity/calendarDataEntity';

/**
 * デシジョンテーブル: validateCalendarDataEntity
 *
 * | #  | id         | raceType          | title      | startTime  | endTime    | location   | description | 期待結果 |
 * |----|------------|-------------------|------------|------------|------------|------------|-------------|----------|
 * |  1 | 文字列     | jra               | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | 成功     |
 * |  2 | 文字列     | nar               | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | 成功     |
 * |  3 | 文字列     | keirin            | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | 成功     |
 * |  4 | 文字列     | overseas          | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | 成功     |
 * |  5 | 文字列     | autorace          | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | 成功     |
 * |  6 | 文字列     | boatrace          | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | 成功     |
 * |  7 | 数値       | jra               | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | エラー   |
 * |  8 | undefined  | jra               | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | エラー   |
 * |  9 | 文字列     | invalid           | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | エラー   |
 * | 10 | 文字列     | undefined         | 文字列     | 文字列     | 文字列     | 文字列     | 文字列      | エラー   |
 * | 11 | 文字列     | jra               | undefined  | 文字列     | 文字列     | 文字列     | 文字列      | エラー   |
 * | 12 | 文字列     | jra               | 文字列     | undefined  | 文字列     | 文字列     | 文字列      | エラー   |
 * | 13 | 文字列     | jra               | 文字列     | 文字列     | undefined  | 文字列     | 文字列      | エラー   |
 * | 14 | 文字列     | jra               | 文字列     | 文字列     | 文字列     | undefined  | 文字列      | エラー   |
 * | 15 | 文字列     | jra               | 文字列     | 文字列     | 文字列     | 文字列     | undefined   | エラー   |
 */
describe('validateCalendarDataEntity', () => {
    const validBase = {
        id: 'calendar-001',
        raceType: RaceType.JRA,
        title: 'Sample Race',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T12:00:00Z',
        location: 'Tokyo Racecourse',
        description: 'A sample race event',
    };

    describe('全フィールドが有効な場合、バリデーションが成功する', () => {
        it.each([
            RaceType.JRA,
            RaceType.NAR,
            RaceType.KEIRIN,
            RaceType.OVERSEAS,
            RaceType.AUTORACE,
            RaceType.BOATRACE,
        ])('raceType="%s" はバリデーションを通過する', (raceType) => {
            const data = { ...validBase, raceType };
            const result = validateCalendarDataEntity(data);
            expect(result).toEqual(data);
        });
    });

    describe('id が不正な場合、バリデーションが失敗する', () => {
        it('id が数値（123）の場合はエラーになる', () => {
            expect(() =>
                validateCalendarDataEntity({ ...validBase, id: 123 }),
            ).toThrow();
        });

        it('id が undefined の場合はエラーになる', () => {
            const { id: _id, ...rest } = validBase;
            expect(() => validateCalendarDataEntity(rest)).toThrow();
        });
    });

    describe('raceType が不正な場合、バリデーションが失敗する', () => {
        it('raceType が未定義の値（"invalid"）の場合はエラーになる', () => {
            expect(() =>
                validateCalendarDataEntity({
                    ...validBase,
                    raceType: 'invalid',
                }),
            ).toThrow();
        });

        it('raceType が undefined の場合はエラーになる', () => {
            const { raceType: _raceType, ...rest } = validBase;
            expect(() => validateCalendarDataEntity(rest)).toThrow();
        });
    });

    describe('必須フィールドが欠落している場合、バリデーションが失敗する', () => {
        it('title が undefined の場合はエラーになる', () => {
            const { title: _title, ...rest } = validBase;
            expect(() => validateCalendarDataEntity(rest)).toThrow();
        });

        it('startTime が undefined の場合はエラーになる', () => {
            const { startTime: _startTime, ...rest } = validBase;
            expect(() => validateCalendarDataEntity(rest)).toThrow();
        });

        it('endTime が undefined の場合はエラーになる', () => {
            const { endTime: _endTime, ...rest } = validBase;
            expect(() => validateCalendarDataEntity(rest)).toThrow();
        });

        it('location が undefined の場合はエラーになる', () => {
            const { location: _location, ...rest } = validBase;
            expect(() => validateCalendarDataEntity(rest)).toThrow();
        });

        it('description が undefined の場合はエラーになる', () => {
            const { description: _description, ...rest } = validBase;
            expect(() => validateCalendarDataEntity(rest)).toThrow();
        });
    });

    describe('バリデーション後のフィールド保持', () => {
        it('バリデーション済みオブジェクトは全フィールドを保持する', () => {
            const validated = validateCalendarDataEntity(validBase);
            expect(validated).toEqual(validBase);
        });
    });
});
