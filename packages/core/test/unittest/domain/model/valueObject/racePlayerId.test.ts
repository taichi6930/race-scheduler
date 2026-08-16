/**
 * RacePlayerIdのテスト
 *
 * ## デシジョンテーブル: validateRacePlayerId
 *
 * racePlayerIdの形式: {RaceType}{yyyymmdd}{location_code}{race_number}{car_number}
 *   - RaceType: jra | nar | keirin | overseas | autorace | boatrace
 *   - yyyymmdd: 8桁の数字
 *   - location_code + race_number: 合わせて4桁の数字
 *   - car_number: 2桁の数字（raceIdの末尾にさらに車番を付加したもの）
 *
 * 正常系
 * | #  | 条件                                 | 入力例                          | 期待結果 |
 * |----|--------------------------------------|----------------------------------|----------|
 * |  1 | RaceType=keirin                      | "keirin20260802360107"           | 成功     |
 * |  2 | RaceType=jra                         | "jra20250105010101"              | 成功     |
 * |  3 | RaceType=boatrace                    | "boatrace20250105010101"         | 成功     |
 * |  4 | car_number最小値(00)                 | "keirin20260802360100"           | 成功     |
 * |  5 | car_number最大値(99)                 | "keirin20260802360199"           | 成功     |
 *
 * 異常系
 * | #  | 条件                                 | 入力例                          | 期待結果 |
 * |----|--------------------------------------|----------------------------------|----------|
 * |  6 | 車番部分が1桁(不足)                  | "keirin202608023601 07"→"keirin2026080236017" | エラー |
 * |  7 | 車番部分が3桁(超過)                  | "keirin20260802360107 8"→"keirin202608023601078" | エラー |
 * |  8 | 車番部分に英字混入                   | "keirin202608023601AB"           | エラー   |
 * |  9 | RaceType不正                        | "JRA20250105010101"              | エラー   |
 * | 10 | 車番部分が無い(raceIdそのまま)       | "keirin202608023601"             | エラー   |
 */
import { describe, expect, it } from 'bun:test';

import { validateRacePlayerId } from '../../../../../src/domain/model/valueObject/racePlayerId';

describe('validateRacePlayerId', () => {
    describe('正常系', () => {
        it.each([
            ['#1: RaceType=keirin', 'keirin20260802360107'],
            ['#2: RaceType=jra', 'jra20250105010101'],
            ['#3: RaceType=boatrace', 'boatrace20250105010101'],
            ['#4: car_number最小値(00)', 'keirin20260802360100'],
            ['#5: car_number最大値(99)', 'keirin20260802360199'],
        ])('%s', (_title, value) => {
            expect<string>(validateRacePlayerId(value)).toBe(value);
        });
    });

    describe('異常系', () => {
        it.each([
            ['#6: 車番部分が1桁(不足)', 'keirin2026080236017'],
            ['#7: 車番部分が3桁(超過)', 'keirin202608023601078'],
            ['#8: 車番部分に英字混入', 'keirin202608023601AB'],
            ['#9: RaceType不正(大文字)', 'JRA20250105010101'],
            ['#10: 車番部分が無い(raceIdそのまま)', 'keirin202608023601'],
        ])('%s', (_title, value) => {
            expect(() => validateRacePlayerId(value)).toThrow();
        });
    });
});
