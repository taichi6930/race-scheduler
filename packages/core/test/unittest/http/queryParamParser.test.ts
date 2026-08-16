/**
 * queryParamParser ユーティリティ テスト
 *
 * ## デシジョンテーブル: parseQueryParams / normalizeSearchParams / normalizeValue
 *
 * | #    | 入力                                   | 期待結果                       | 対象分岐                         |
 * |------|----------------------------------------|--------------------------------|----------------------------------|
 * | T-01 | name=test                              | { name: "test" }               | 文字列（数値/真偽/日付いずれも非該当） |
 * | T-02 | name=john&email=...                    | 2 フィールド                   | 複数キー                         |
 * | T-03 | active=true                            | { active: true }               | value === 'true'                 |
 * | T-04 | active=false                           | { active: false }              | value === 'false'                |
 * | T-05 | date=2024-02-15                        | Date                           | YYYY-MM-DD 有効日付              |
 * | T-06 | age=30                                 | 30 (number)                    | 整数正規表現マッチ               |
 * | T-07 | age=invalid                            | ValidationError                | safeParse 失敗                   |
 * | T-08 | 必須欠落                               | ValidationError                | safeParse 失敗                   |
 * | T-09 | ids=1&ids=2&ids=3                      | number[]                       | 同一キー複数値（配列 push）      |
 * | T-10 | tags=tag1,tag2,tag3                    | string[]                       | カンマ区切り→配列               |
 * | T-11 | name=test（description 省略）          | { name }                       | optional 未指定                  |
 * | T-12 | value=2024-13-45                       | "2024-13-45"                   | YYYY-MM-DD だが無効日付          |
 * | T-13 | value=2024-13-45T12:00:00Z            | 文字列のまま                   | ISO だが無効日付                 |
 * | T-14 | price=19.99                            | 19.99                          | 浮動小数点                       |
 * | T-15 | value=-3.14                            | -3.14                          | 負の浮動小数点                   |
 * | T-16 | name=test&ids=1&ids=2&tags=a,b,c       | 混在                           | 既存キーが配列（既存 push 側）   |
 * | T-17 | prices=19.99,29.99,39.99              | number[]                       | カンマ区切り＋数値変換           |
 * | T-18 | value=00123                            | "00123"                        | ゼロプレフィックス→文字列       |
 * | T-19 | values=a,b&values=c,d                  | string[]                       | 複数値＋カンマ区切り両方         |
 * | T-20 | dates=ISO,ISO                          | Date[]                         | ISO 有効日付（カンマ区切り）     |
 * | T-21 | timestamp=無効ISO                      | 文字列のまま                   | ISO 無効日付                     |
 * | T-22 | date=2024-02-15                        | JST深夜0時のDate                | YYYY-MM-DD をJST基準でパース     |
 * | T-23 | values=a,b&values=c,d                   | ['a,b','c,d']（要素内は未分割） | PERF-087: 1パス化後も既存の複数値+カンマ混在の挙動を維持 |
 * | T-24 | locationList=31（先頭ゼロ無し数字）    | ['31']（文字列配列）           | 回帰: numberへ自動変換された値をsearchRaceFilterParamsSchemaが受理できる |
 * | T-25 | locationList=44&locationList=43         | ['44','43']（文字列配列）      | 回帰: Dio ListFormat.multi（同一キー複数回）でも同様 |
 * | T-26 | values=a&values=b,c                     | ['a','b,c']（要素内は未分割）  | 繰り返しキー＋カンマ区切りの非対称混在（1回目は単値、2回目はカンマ含む） |
 */

import { describe, expect, it } from 'bun:test';
import {
    parseQueryParams,
    searchRaceFilterParamsSchema,
} from '@race-schedule/core';
import { z } from 'zod';

describe('queryParamParser', () => {
    describe('parseQueryParams', () => {
        it('[T-01] parseQueryParams_簡単な文字列パラメータ_パースする', () => {
            // Arrange
            const schema = z.object({ name: z.string() });
            const searchParams = new URLSearchParams('name=test');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.name).toBe('test');
        });

        it('[T-02] parseQueryParams_複数の文字列パラメータ_パースする', () => {
            // Arrange
            const schema = z.object({ name: z.string(), email: z.string() });
            const searchParams = new URLSearchParams(
                'name=john&email=john@example.com',
            );

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.name).toBe('john');
            expect(result.email).toBe('john@example.com');
        });

        it('[T-03] parseQueryParams_true文字列_booleanのtrueに変換する', () => {
            // Arrange
            const schema = z.object({ active: z.boolean() });
            const searchParams = new URLSearchParams('active=true');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.active).toBe(true);
        });

        it('[T-04] parseQueryParams_false文字列_booleanのfalseに変換する', () => {
            // Arrange
            const schema = z.object({ active: z.boolean() });
            const searchParams = new URLSearchParams('active=false');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.active).toBe(false);
        });

        it('[T-05] parseQueryParams_YYYY-MM-DD有効日付_Dateに変換する', () => {
            // Arrange
            const schema = z.object({ date: z.date() });
            const searchParams = new URLSearchParams('date=2024-02-15');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.date instanceof Date).toBe(true);
        });

        it('[T-06] parseQueryParams_整数文字列_numberに変換する', () => {
            // Arrange
            const schema = z.object({ age: z.number() });
            const searchParams = new URLSearchParams('age=30');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.age).toBe(30);
        });

        it('[T-07] parseQueryParams_スキーマ不適合_ValidationErrorを投げる', () => {
            // Arrange
            const schema = z.object({ age: z.number() });
            const searchParams = new URLSearchParams('age=invalid');

            // Act & Assert
            expect(() => parseQueryParams(schema, searchParams)).toThrow();
        });

        it('[T-08] parseQueryParams_必須パラメータ欠落_ValidationErrorを投げる', () => {
            // Arrange
            const schema = z.object({
                name: z.string(),
                required: z.string(),
            });
            const searchParams = new URLSearchParams('name=test');

            // Act & Assert
            expect(() => parseQueryParams(schema, searchParams)).toThrow();
        });

        it('[T-09] parseQueryParams_同一キー複数値_配列に変換する', () => {
            // Arrange
            const schema = z.object({ ids: z.array(z.number()) });
            const searchParams = new URLSearchParams('ids=1&ids=2&ids=3');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(Array.isArray(result.ids)).toBe(true);
            expect(result.ids).toHaveLength(3);
        });

        it('[T-10] parseQueryParams_カンマ区切り文字列_配列に変換する', () => {
            // Arrange
            const schema = z.object({ tags: z.array(z.string()) });
            const searchParams = new URLSearchParams('tags=tag1,tag2,tag3');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(Array.isArray(result.tags)).toBe(true);
            expect(result.tags.length).toBeGreaterThan(0);
        });

        it('[T-11] parseQueryParams_オプショナルパラメータ省略_パースする', () => {
            // Arrange
            const schema = z.object({
                name: z.string(),
                description: z.string().optional(),
            });
            const searchParams = new URLSearchParams('name=test');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.name).toBe('test');
        });

        it('[T-12] parseQueryParams_YYYY-MM-DD形式で無効な日付_文字列のまま返す', () => {
            // Arrange
            const schema = z.object({ value: z.string() });
            const searchParams = new URLSearchParams('value=2024-13-45');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.value).toBe('2024-13-45');
        });

        it('[T-13] parseQueryParams_ISO形式で無効な日付_文字列のまま返す', () => {
            // Arrange
            const schema = z.object({ value: z.string() });
            const searchParams = new URLSearchParams(
                'value=2024-13-45T12:00:00Z',
            );

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.value).toBe('2024-13-45T12:00:00Z');
        });

        it('[T-14] parseQueryParams_浮動小数点数_numberに変換する', () => {
            // Arrange
            const schema = z.object({ price: z.number() });
            const searchParams = new URLSearchParams('price=19.99');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.price).toBe(19.99);
        });

        it('[T-15] parseQueryParams_負の浮動小数点数_numberに変換する', () => {
            // Arrange
            const schema = z.object({ value: z.number() });
            const searchParams = new URLSearchParams('value=-3.14');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.value).toBe(-3.14);
        });

        it('[T-16] parseQueryParams_複数パラメータとカンマ区切りと複数値の混合_パースする', () => {
            // Arrange
            const schema = z.object({
                name: z.string(),
                ids: z.array(z.number()),
                tags: z.array(z.string()),
            });
            const searchParams = new URLSearchParams(
                'name=test&ids=1&ids=2&tags=a,b,c',
            );

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.name).toBe('test');
            expect(result.ids).toHaveLength(2);
            expect(result.tags).toHaveLength(3);
        });

        it('[T-17] parseQueryParams_カンマ区切りの浮動小数点数_number配列に変換する', () => {
            // Arrange
            const schema = z.object({ prices: z.array(z.number()) });
            const searchParams = new URLSearchParams(
                'prices=19.99,29.99,39.99',
            );

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.prices).toContain(19.99);
            expect(result.prices).toContain(29.99);
            expect(result.prices).toContain(39.99);
        });

        it('[T-18] parseQueryParams_ゼロプレフィックス_文字列として保持する', () => {
            // Arrange
            const schema = z.object({ value: z.string() });
            const searchParams = new URLSearchParams('value=00123');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.value).toBe('00123');
            expect(typeof result.value).toBe('string');
        });

        it('[T-19] parseQueryParams_複数値かつカンマ区切りを含む_配列に変換する', () => {
            // Arrange
            const schema = z.object({ values: z.array(z.string()) });
            const searchParams = new URLSearchParams('values=a,b&values=c,d');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(Array.isArray(result.values)).toBe(true);
            expect(result.values.length).toBeGreaterThanOrEqual(2);
        });

        it('[T-23] parseQueryParams_同一キーが複数回出現しかつ各値がカンマを含む_要素内は分割せず既存挙動を維持する', () => {
            // PERF-087: 1パス化のリファクタ後も、キーが複数回出現した場合は
            // （既存実装と同様に）各出現値の内部でカンマ分割を行わないことを
            // 厳密な配列内容で固定する（[T-19] は length のみの緩い検証のため補完）。
            // Arrange
            const schema = z.object({ values: z.array(z.string()) });
            const searchParams = new URLSearchParams('values=a,b&values=c,d');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.values).toEqual(['a,b', 'c,d']);
        });

        it('[T-26] parseQueryParams_同一キーが繰り返しかつ2回目以降のみカンマを含む_要素内は分割せず配列化する', () => {
            // 同じクエリパラメータが「繰り返しキー」(?x=a&x=b) と
            // 「カンマ区切り」(?x=a,b) の両方の形で同時に届く非対称なケース。
            // 1回目（a）は単値のためカンマ分割候補(pendingRawValues)に載るが、
            // 2回目の出現(b,c)でキーが複数回登場したと判定され、
            // pendingRawValuesから外れて分割は行われない（T-19/T-23の対称ケースを補完）。
            // Arrange
            const schema = z.object({ values: z.array(z.string()) });
            const searchParams = new URLSearchParams('values=a&values=b,c');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.values).toEqual(['a', 'b,c']);
        });

        it('[T-20] parseQueryParams_ISO有効日付のカンマ区切り_Date配列に変換する', () => {
            // Arrange
            const schema = z.object({ dates: z.array(z.date()) });
            const searchParams = new URLSearchParams(
                'dates=2024-01-15T10:30:00Z,2024-02-20T11:45:00Z',
            );

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(Array.isArray(result.dates)).toBe(true);
            expect(result.dates[0] instanceof Date).toBe(true);
        });

        it('[T-21] parseQueryParams_ISO形式で無効なタイムスタンプ_文字列のまま返す', () => {
            // Arrange
            const schema = z.object({ timestamp: z.string() });
            const searchParams = new URLSearchParams(
                'timestamp=2024-13-45T25:99:99Z',
            );

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(typeof result.timestamp).toBe('string');
        });

        it('[T-22] parseQueryParams_YYYY-MM-DD形式_JST深夜0時としてパースする', () => {
            // Arrange
            // `new Date('YYYY-MM-DD')` はUTC深夜0時として解釈されるため、
            // DB側のJST深夜0時基準（date_time列）と9時間ズレる。
            // startDate === finishDate の単一日レンジ検索が0件になる回帰を防ぐため、
            // JST深夜0時（UTC比-9時間）としてパースされることを検証する。
            const schema = z.object({ date: z.date() });
            const searchParams = new URLSearchParams('date=2024-02-15');

            // Act
            const result = parseQueryParams(schema, searchParams);

            // Assert
            expect(result.date.toISOString()).toBe('2024-02-14T15:00:00.000Z');
        });

        it('[T-24] parseQueryParams_locationListが先頭ゼロ無しの数字のみ_ValidationErrorを投げず文字列配列になる（回帰）', () => {
            // 場所コード（例: 高知31・小倉81・大垣44）は先頭ゼロが無いと
            // normalizeValue が number へ変換してしまい、`z.string()` ベースの
            // フィールドが「Invalid input」で 400 になる回帰があった
            // （front の旅程グループ機能で発覚。schemas/common.ts の
            // optionalStringListField を参照）。GET /race と同じ
            // searchRaceFilterParamsSchema を通して固定する。
            // Arrange
            const searchParams = new URLSearchParams(
                'startDate=2026-07-27&finishDate=2027-01-23&raceTypeList=nar&locationList=31',
            );

            // Act
            const result = parseQueryParams(
                searchRaceFilterParamsSchema,
                searchParams,
            );

            // Assert
            expect(result.locationList).toEqual(['31']);
        });

        it('[T-25] parseQueryParams_locationListが複数の先頭ゼロ無し数字（同一キー複数回）_文字列配列になる（回帰）', () => {
            // Arrange: Dio の既定 ListFormat.multi は複数要素のリストを
            // 同一キーの繰り返し（`locationList=44&locationList=43`）で送る。
            const searchParams = new URLSearchParams(
                'startDate=2026-07-27&finishDate=2027-01-23&raceTypeList=keirin&locationList=44&locationList=43',
            );

            // Act
            const result = parseQueryParams(
                searchRaceFilterParamsSchema,
                searchParams,
            );

            // Assert
            expect(result.locationList).toEqual(['44', '43']);
        });
    });
});
