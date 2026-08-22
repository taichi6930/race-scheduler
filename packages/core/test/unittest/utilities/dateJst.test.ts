/**
 * dateJst ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | createJstDate | year,month,day | JST Date | Line |
 * | 2  | createJstDate | with time params | JST Date with time | Line |
 * | 3  | getJstYear | Date | JST year | Line |
 * | 4  | getJstMonth | Date | JST month (1-12) | Line |
 * | 5  | getJstDate | Date | JST day (1-31) | Line |
 * | 6  | getJstHours | Date | JST hour (0-23) | Line |
 * | 7  | getJstMinutes | Date | JST minute (0-59) | Line |
 * | 8  | getJstSeconds | Date | JST second (0-59) | Line |
 * | 9  | toJstISOString | Date | ISO format string | Line |
 * | 10 | JST_TIMEZONE | const | 'Asia/Tokyo' | Line |
 * | 11 | MS_PER_DAY | const | 86400000 | Line |
 * | T-11 | formatJstDatetime | UTC 文字列 | JST 変換後の Date オブジェクト | Line |
 * | T-12 | formatJstDatetime | Date オブジェクト | JST 変換後の Date オブジェクト | Line |
 * | T-13 | formatJstDatetime | JST +09:00 文字列 | 同一瞬間の Date | Line |
 * | T-14 | formatJstDatetime | 無効文字列 | TypeError をスロー | Branch |
 * | T-15 | formatJstDatetime | 深夜 23:59:59 JST | 正しく変換されること | Line |
 * | T-16 | formatJstDatetime | 年をまたぐ境界値 | JST 2024-01-01T00:00:00+09:00 | Line |
 * | T-17 | formatJstDatetime | 夏時間なし確認（7月） | UTC+9 固定で変換 | Line |
 * | T-18 | formatJstDatetime | Invalid Date オブジェクト | TypeError をスロー | Branch |
 * | T-19 | formatJstDatetime | 遠未来（6桁年）で整形結果が不正 | TypeError をスロー | Branch |
 * | T-20 | toJstISOString | JST深夜0時ちょうど（UTC 15:00 前日） | '...T00:00:00+09:00'（完全一致） | Line |
 * | T-21 | toJstISOString | JST 23:59:59（1日の最終秒） | '...T23:59:59+09:00'（完全一致） | Line |
 * | T-22 | toJstISOString | JST年またぎ（12/31 23:59:59 → 1/1 00:00:00） | 完全一致（PERF-091: formatToParts化で1文字も変わらないことを担保） | Line |
 * | T-23 | toJstISOString | formatToPartsが深夜0時を"24"として返すICU実装（モック） | '00'に正規化されること | Branch |
 */

import { describe, expect, it, spyOn } from 'bun:test';
import {
    createJstDate,
    formatJstDatetime,
    getJstDate,
    getJstHours,
    getJstMinutes,
    getJstMonth,
    getJstSeconds,
    getJstYear,
    JST_TIMEZONE,
    MS_PER_DAY,
    toJstISOString,
} from '@race-schedule/core';

describe('Date JST Utilities', () => {
    describe('JST_TIMEZONE', () => {
        it('JST_TIMEZONE は Asia/Tokyo', () => {
            expect(JST_TIMEZONE).toBe('Asia/Tokyo');
        });
    });

    describe('MS_PER_DAY', () => {
        it('MS_PER_DAY は86400000（24*60*60*1000）', () => {
            expect(MS_PER_DAY).toBe(86_400_000);
        });
    });

    describe('createJstDate', () => {
        it('year, month, day から JST Date を作成', () => {
            const date = createJstDate(2024, 4, 26);

            expect(date instanceof Date).toBe(true);
            expect(getJstYear(date)).toBe(2024);
            expect(getJstMonth(date)).toBe(4);
            expect(getJstDate(date)).toBe(26);
        });

        it('時分秒パラメータ付きで JST Date を作成', () => {
            const date = createJstDate(2024, 4, 26, 15, 30, 45);

            expect(getJstYear(date)).toBe(2024);
            expect(getJstMonth(date)).toBe(4);
            expect(getJstDate(date)).toBe(26);
            expect(getJstHours(date)).toBe(15);
            expect(getJstMinutes(date)).toBe(30);
            expect(getJstSeconds(date)).toBe(45);
        });

        it('時分秒パラメータが省略できる', () => {
            const date = createJstDate(2024, 1, 1);

            expect(getJstHours(date)).toBe(0);
            expect(getJstMinutes(date)).toBe(0);
            expect(getJstSeconds(date)).toBe(0);
        });

        it('異なる月で正しく動作', () => {
            const jan = createJstDate(2024, 1, 15);
            const dec = createJstDate(2024, 12, 25);

            expect(getJstMonth(jan)).toBe(1);
            expect(getJstMonth(dec)).toBe(12);
        });

        it('1行目の日付で正しく動作', () => {
            const first = createJstDate(2024, 1, 1);
            const tenth = createJstDate(2024, 1, 10);

            expect(getJstDate(first)).toBe(1);
            expect(getJstDate(tenth)).toBe(10);
        });
    });

    describe('getJstYear', () => {
        it('JST 年を取得', () => {
            const date = new Date('2024-04-25T15:00:00Z'); // UTC
            const year = getJstYear(date);

            expect(year).toBe(2024);
        });

        it('別の年でも正しく取得', () => {
            const date2023 = new Date('2023-12-31T23:59:59Z');
            const date2025 = new Date('2025-01-01T00:00:00Z');

            expect(getJstYear(date2023)).toBe(2024); // UTC 2023-12-31 23:59:59 は JST 2024-01-01
            expect(getJstYear(date2025)).toBe(2025);
        });
    });

    describe('getJstMonth', () => {
        it('JST 月を取得', () => {
            const date = new Date('2024-04-15T00:00:00Z'); // UTC 2024-04-15 00:00:00 は JST 2024-04-15 09:00:00
            const month = getJstMonth(date);

            expect(month).toBe(4);
        });

        it('月の境界で正しく動作', () => {
            const endOfMonth = new Date('2024-03-31T14:59:59Z'); // UTC 2024-03-31 14:59:59 は JST 2024-03-31 23:59:59
            const startOfMonth = new Date('2024-03-31T15:00:00Z'); // UTC 2024-03-31 15:00:00 は JST 2024-04-01 00:00:00

            expect(getJstMonth(endOfMonth)).toBe(3);
            expect(getJstMonth(startOfMonth)).toBe(4);
        });
    });

    describe('getJstDate', () => {
        it('JST 日を取得', () => {
            const date = new Date('2024-04-25T15:00:00Z'); // JST 2024-04-26
            const day = getJstDate(date);

            expect(day).toBe(26);
        });

        it('月末日で正しく動作', () => {
            const date = new Date('2024-03-31T14:59:59Z');
            const day = getJstDate(date);

            expect(day).toBe(31);
        });

        it('異なる日でも正しく取得', () => {
            const day1 = createJstDate(2024, 4, 1);
            const day15 = createJstDate(2024, 4, 15);
            const day31 = createJstDate(2024, 4, 30); // 4月は30日

            expect(getJstDate(day1)).toBe(1);
            expect(getJstDate(day15)).toBe(15);
            expect(getJstDate(day31)).toBe(30);
        });
    });

    describe('getJstHours', () => {
        it('JST 時を取得', () => {
            const date = new Date('2024-04-25T15:00:00Z'); // JST 2024-04-26 00:00:00
            const hour = getJstHours(date);

            expect(hour).toBe(0);
        });

        it('その他の時刻でも正しく取得', () => {
            const date = createJstDate(2024, 4, 26, 23, 0, 0);
            const hour = getJstHours(date);

            expect(hour).toBe(23);
        });

        it.each(Array.from({ length: 24 }, (_, h) => h))(
            '0時から23時まで すべての時刻をサポート: %i時',
            (h) => {
                const date = createJstDate(2024, 4, 26, h, 0, 0);
                expect(getJstHours(date)).toBe(h);
            },
        );
    });

    describe('getJstMinutes', () => {
        it('JST 分を取得', () => {
            const date = new Date('2024-04-25T15:30:00Z'); // JST 2024-04-26 00:30:00
            const minute = getJstMinutes(date);

            expect(minute).toBe(30);
        });

        it('その他の分でも正しく取得', () => {
            const date = createJstDate(2024, 4, 26, 12, 45, 0);
            const minute = getJstMinutes(date);

            expect(minute).toBe(45);
        });
    });

    describe('getJstSeconds', () => {
        it('JST 秒を取得', () => {
            const date = new Date('2024-04-25T15:00:45Z'); // JST 2024-04-26 00:00:45
            const second = getJstSeconds(date);

            expect(second).toBe(45);
        });

        it('その他の秒でも正しく取得', () => {
            const date = createJstDate(2024, 4, 26, 12, 30, 15);
            const second = getJstSeconds(date);

            expect(second).toBe(15);
        });
    });

    describe('toJstISOString', () => {
        it('Date を JST ISO 8601 形式の文字列に変換', () => {
            const date = createJstDate(2024, 4, 26, 15, 30, 45);
            const isoString = toJstISOString(date);

            expect(isoString).toContain('2024-04-26');
            expect(isoString).toContain('15:30:45');
            expect(isoString).toContain('+09:00');
        });

        it('ISO 形式文字列から作成した Date で往復できる', () => {
            const original = createJstDate(2024, 4, 26, 12, 34, 56);
            const isoString = toJstISOString(original);
            const reconstructed = new Date(isoString);

            expect(getJstYear(reconstructed)).toBe(2024);
            expect(getJstMonth(reconstructed)).toBe(4);
            expect(getJstDate(reconstructed)).toBe(26);
            expect(getJstHours(reconstructed)).toBe(12);
            expect(getJstMinutes(reconstructed)).toBe(34);
            expect(getJstSeconds(reconstructed)).toBe(56);
        });

        it('異なる日付で正しく形式を生成', () => {
            const date1 = createJstDate(2020, 1, 1);
            const date2 = createJstDate(2024, 12, 31);

            const iso1 = toJstISOString(date1);
            const iso2 = toJstISOString(date2);

            expect(iso1).toContain('2020-01-01');
            expect(iso2).toContain('2024-12-31');
        });

        it('時間の 0 パディングが正しく機能', () => {
            const date = createJstDate(2024, 1, 1, 1, 2, 3);
            const isoString = toJstISOString(date);

            expect(isoString).toContain('2024-01-01');
            expect(isoString).toContain('01:02:03');
        });

        it('[T-20] toJstISOString_JST深夜0時ちょうど_完全一致で00時と整形されること', () => {
            // UTC 2024-04-25T15:00:00Z は JST 2024-04-26T00:00:00+09:00
            const date = new Date('2024-04-25T15:00:00.000Z');

            expect(toJstISOString(date)).toBe('2024-04-26T00:00:00+09:00');
        });

        it('[T-21] toJstISOString_JST23時59分59秒_完全一致で整形されること', () => {
            const date = createJstDate(2024, 4, 26, 23, 59, 59);

            expect(toJstISOString(date)).toBe('2024-04-26T23:59:59+09:00');
        });

        it('[T-22] toJstISOString_JST年またぎの境界値_完全一致で整形されること', () => {
            // PERF-091: formatToParts() へ実装変更後も出力文字列が1文字も
            // 変わらないことを、年またぎの境界値で厳密一致（toBe）で担保する。
            const beforeMidnight = createJstDate(2024, 12, 31, 23, 59, 59);
            const afterMidnight = createJstDate(2025, 1, 1, 0, 0, 0);

            expect(toJstISOString(beforeMidnight)).toBe(
                '2024-12-31T23:59:59+09:00',
            );
            expect(toJstISOString(afterMidnight)).toBe(
                '2025-01-01T00:00:00+09:00',
            );
        });

        it('[T-23] toJstISOString_formatToPartsが深夜0時を24として返す場合_00に正規化されること', () => {
            // Arrange: 一部のICU実装ではhour12:false指定時に深夜0時が"24"として
            // 返る既知の挙動差がある。手元のICU実装では再現できないため、
            // Intl.DateTimeFormat.prototype.formatToPartsをモックしてその挙動を再現する。
            const spy = spyOn(
                Intl.DateTimeFormat.prototype,
                'formatToParts',
            ).mockReturnValue([
                { type: 'year', value: '2024' },
                { type: 'literal', value: '-' },
                { type: 'month', value: '04' },
                { type: 'literal', value: '-' },
                { type: 'day', value: '26' },
                { type: 'literal', value: ', ' },
                { type: 'hour', value: '24' },
                { type: 'literal', value: ':' },
                { type: 'minute', value: '00' },
                { type: 'literal', value: ':' },
                { type: 'second', value: '00' },
            ]);

            // Act
            const result = toJstISOString(new Date('2024-04-25T15:00:00.000Z'));

            // Assert
            expect(result).toBe('2024-04-26T00:00:00+09:00');

            spy.mockRestore();
        });
    });

    describe('formatJstDatetime', () => {
        it('T-11_UTC文字列を渡す_JSTに変換された正しいDateを返す', () => {
            // Arrange
            const input = '2024-04-25T15:00:00Z'; // UTC 15:00 = JST 翌日 0:00

            // Act
            const result = formatJstDatetime(input);

            // Assert
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(
                new Date('2024-04-26T00:00:00+09:00').getFullYear(),
            );
            expect(result.toISOString()).toBe('2024-04-25T15:00:00.000Z');
        });

        it('T-12_Dateオブジェクトを渡す_JSTに変換された正しいDateを返す', () => {
            // Arrange
            const input = new Date('2024-04-25T15:00:00Z');

            // Act
            const result = formatJstDatetime(input);

            // Assert
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2024-04-25T15:00:00.000Z');
        });

        it('T-13_JST文字列を渡す_同一瞬間のDateを返す', () => {
            // Arrange
            const input = '2024-04-26T00:00:00+09:00'; // JST 0:00 = UTC 15:00 前日

            // Act
            const result = formatJstDatetime(input);

            // Assert
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2024-04-25T15:00:00.000Z');
        });

        it('T-14_無効な文字列を渡す_TypeErrorをスローする', () => {
            // Arrange / Act / Assert
            expect(() => formatJstDatetime('not-a-date')).toThrow(TypeError);
        });

        it('T-15_深夜23時59分59秒JST_正しく変換されること', () => {
            // Arrange
            const input = '2024-04-25T14:59:59Z'; // UTC 14:59:59 = JST 2024-04-25T23:59:59+09:00

            // Act
            const result = formatJstDatetime(input);

            // Assert
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2024-04-25T14:59:59.000Z');
        });

        it('T-16_年をまたぐ境界値_JST元日になること', () => {
            // Arrange
            const input = '2023-12-31T15:00:00Z'; // UTC = JST 2024-01-01T00:00:00+09:00

            // Act
            const result = formatJstDatetime(input);

            // Assert
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2023-12-31T15:00:00.000Z');
        });

        it('T-17_夏時間なし確認（7月）_UTC+9固定で変換されること', () => {
            // Arrange
            const input = '2024-07-01T15:00:00Z'; // UTC = JST 2024-07-02T00:00:00+09:00

            // Act
            const result = formatJstDatetime(input);

            // Assert
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2024-07-01T15:00:00.000Z');
        });

        it('T-18_Invalid_Dateオブジェクトを渡す_TypeErrorをスローする', () => {
            // Arrange
            const invalidDate = new Date('invalid');

            // Act & Assert
            expect(() => formatJstDatetime(invalidDate)).toThrow(TypeError);
        });

        it('T-19_遠未来の有効なDate_整形結果が不正でTypeErrorをスローする', () => {
            // Arrange
            // 入力自体は有効な Date だが、JST シフト後の年が 6 桁になり、
            // 内部で生成する `YYYY-MM-DDT...+09:00` 文字列が不正となる。
            const farFuture = new Date('+275760-09-12T00:00:00Z');

            // Act & Assert
            expect(() => formatJstDatetime(farFuture)).toThrow(TypeError);
        });
    });
});
