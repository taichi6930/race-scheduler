/**
 * schemas/common テスト
 *
 * ## デシジョンテーブル: normalizeRaceTypeList
 *
 * | #    | 入力型   | 入力値              | 期待結果        |
 * |------|----------|---------------------|-----------------|
 * | T-01 | array    | ["jra","nar"]       | ["jra","nar"]   |
 * | T-02 | string   | "jra,nar"           | ["jra","nar"]   |
 * | T-03 | string   | "jra"               | ["jra"]         |
 * | T-04 | string   | "jra , nar"         | ["jra","nar"]   |
 * | T-05 | それ以外 | 123 (非文字列)      | []              |
 *
 * ## デシジョンテーブル: parseWithValidation
 *
 * | #    | Schema           | Input                          | 期待結果                        |
 * |------|------------------|--------------------------------|---------------------------------|
 * | T-06 | z.string()       | "hello"                        | "hello"                         |
 * | T-07 | z.string()       | 123                            | ValidationError(400)            |
 * | T-08 | z.object()       | 有効なobject                   | object を返す                   |
 * | T-09 | z.string()       | 123                            | ValidationError status=400      |
 * | T-10 | z.object().strict| {a:123, b:"hello"}             | ValidationError                 |
 * | T-11 | z.number()       | 42                             | 42                              |
 * | T-12 | z.array()        | [1,2,3]                        | [1,2,3]                         |
 * | T-13 | z.array()        | "invalid"                      | ValidationError                 |
 * | T-14 | z.object()       | 複数不正                       | ':' を含むメッセージ            |
 *
 * ## デシジョンテーブル: formatZodIssues
 *
 * | #    | issue.path 長 | issue 数 | 期待結果            |
 * |------|---------------|----------|---------------------|
 * | T-15 | >0            | 1        | "path: message"     |
 * | T-17 | 0             | 1        | "unknown: message"  |
 * | T-18 | >0            | 複数     | ', ' で連結         |
 *
 * ## デシジョンテーブル: extractIndexedIssue
 *
 * | #    | issue                          | 期待結果                    |
 * |------|---------------------------------|------------------------------|
 * | T-19 | undefined                      | undefined                    |
 * | T-20 | path[0] が number               | { index, message }           |
 * | T-21 | path[0] が number 以外（string）| undefined                    |
 *
 * ## デシジョンテーブル: optionalStringListField
 *
 * `locationList`/`gradeList` で共有される任意フィールド。バグ回帰防止用:
 * `queryParamParser.ts` の `normalizeSearchParams` は先頭ゼロ無しの数字のみの
 * 文字列（例: 場所コード `'31'`）を number へ自動変換するため、number も
 * 受理して文字列へ正規化できる必要がある（この変換が無いと front の
 * 旅程グループ機能で `locationList: Invalid input` の 400 が発生していた）。
 *
 * | #    | 入力値              | 期待結果      |
 * |------|---------------------|---------------|
 * | T-22 | "tokyo"（文字列）    | ["tokyo"]     |
 * | T-23 | 31（number、単一）  | ["31"]        |
 * | T-24 | [44, 43]（number配列）| ["44","43"] |
 * | T-25 | undefined           | undefined     |
 */

import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@race-schedule/core';
import { z } from 'zod';

import {
    extractIndexedIssue,
    formatZodIssues,
    normalizeRaceTypeList,
    optionalStringListField,
    parseWithValidation,
} from '../../../src/schemas/common';

describe('normalizeRaceTypeList', () => {
    it('[T-01] normalizeRaceTypeList_文字列配列_そのまま返す', () => {
        // Arrange & Act
        const result = normalizeRaceTypeList(['jra', 'nar']);

        // Assert
        expect(result).toEqual(['jra', 'nar']);
    });

    it('[T-02] normalizeRaceTypeList_カンマ区切り文字列_配列に分割する', () => {
        // Arrange & Act
        const result = normalizeRaceTypeList('jra,nar');

        // Assert
        expect(result).toEqual(['jra', 'nar']);
    });

    it('[T-03] normalizeRaceTypeList_単一文字列_単要素の配列に変換する', () => {
        // Arrange & Act
        const result = normalizeRaceTypeList('jra');

        // Assert
        expect(result).toEqual(['jra']);
    });

    it('[T-04] normalizeRaceTypeList_カンマ区切りの空白_トリムする', () => {
        // Arrange & Act
        const result = normalizeRaceTypeList('jra , nar');

        // Assert
        expect(result).toEqual(['jra', 'nar']);
    });

    it('[T-05] normalizeRaceTypeList_文字列でも配列でもない値_空配列を返す', () => {
        // Arrange (型定義違反の実行時入力を検証するため unknown 経由で渡す)
        const value = 123 as unknown as string;

        // Act
        const result = normalizeRaceTypeList(value);

        // Assert
        expect(result).toEqual([]);
    });
});

describe('parseWithValidation', () => {
    it('[T-06] parseWithValidation_スキーマに適合する入力_返す', () => {
        // Arrange
        const schema = z.string();

        // Act
        const result = parseWithValidation(schema, 'hello');

        // Assert
        expect(result).toBe('hello');
    });

    it('[T-07] parseWithValidation_スキーマに不適合な入力_ValidationErrorを投げる', () => {
        // Arrange
        const schema = z.string();

        // Act & Assert
        expect(() => parseWithValidation(schema, 123)).toThrow(ValidationError);
    });

    it('[T-08] parseWithValidation_オブジェクトスキーマで有効な入力_返す', () => {
        // Arrange
        const schema = z.object({ name: z.string(), age: z.number() });
        const input = { name: 'taro', age: 25 };

        // Act
        const result = parseWithValidation(schema, input);

        // Assert
        expect(result).toEqual(input);
    });

    it('[T-09] parseWithValidation_不適合入力_ValidationErrorのstatusが400', () => {
        // Arrange
        const schema = z.string();

        // Act & Assert
        try {
            parseWithValidation(schema, 123);
            throw new Error('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
            expect((e as ValidationError).status).toBe(400);
        }
    });

    it('[T-10] parseWithValidation_複数のバリデーションエラー_メッセージが連結される', () => {
        // Arrange
        const schema = z.object({ a: z.string(), b: z.number() }).strict();

        // Act & Assert
        try {
            parseWithValidation(schema, { a: 123, b: 'hello' });
            throw new Error('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
        }
    });

    it('[T-11] parseWithValidation_数値スキーマ_正常にパースする', () => {
        // Arrange
        const schema = z.number();

        // Act
        const result = parseWithValidation(schema, 42);

        // Assert
        expect(result).toBe(42);
    });

    it('[T-12] parseWithValidation_配列スキーマ_正常にパースする', () => {
        // Arrange
        const schema = z.array(z.number());

        // Act
        const result = parseWithValidation(schema, [1, 2, 3]);

        // Assert
        expect(result).toEqual([1, 2, 3]);
    });

    it('[T-13] parseWithValidation_配列スキーマに文字列入力_ValidationErrorを投げる', () => {
        // Arrange
        const schema = z.array(z.number());

        // Act & Assert
        expect(() => parseWithValidation(schema, 'invalid')).toThrow(
            ValidationError,
        );
    });

    it('[T-14] parseWithValidation_複数のエラーパス_メッセージにコロンを含む', () => {
        // Arrange
        const schema = z.object({
            a: z.string(),
            b: z.number(),
            c: z.boolean(),
        });

        // Act & Assert
        try {
            parseWithValidation(schema, { a: 123, b: 'hello', c: 'not bool' });
            throw new Error('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
            expect((e as ValidationError).message).toContain(':');
        }
    });
});

describe('formatZodIssues', () => {
    it('[T-15] formatZodIssues_path有り_既定オプション_pathコロンmessage形式で返す', () => {
        // Arrange
        const issues = [{ path: ['name'], message: '必須です' }];

        // Act
        const result = formatZodIssues(issues);

        // Assert
        expect(result).toBe('name: 必須です');
    });

    it('[T-17] formatZodIssues_pathが空_unknownをパスとして使う', () => {
        // Arrange
        const issues = [{ path: [], message: '不正です' }];

        // Act
        const result = formatZodIssues(issues);

        // Assert
        expect(result).toBe('unknown: 不正です');
    });

    it('[T-18] formatZodIssues_複数issue_カンマ区切りで連結する', () => {
        // Arrange
        const issues = [
            { path: ['a'], message: 'e1' },
            { path: ['b'], message: 'e2' },
        ];

        // Act
        const result = formatZodIssues(issues);

        // Assert
        expect(result).toBe('a: e1, b: e2');
    });
});

describe('extractIndexedIssue', () => {
    it('[T-19] extractIndexedIssue_issueがundefined_undefinedを返す', () => {
        // Arrange & Act
        const result = extractIndexedIssue(undefined);

        // Assert
        expect(result).toBeUndefined();
    });

    it('[T-20] extractIndexedIssue_path先頭がnumber_indexとmessageを返す', () => {
        // Arrange
        const issue = { path: [2, 'field'], message: '不正な値です' };

        // Act
        const result = extractIndexedIssue(issue);

        // Assert
        expect(result).toEqual({ index: 2, message: '不正な値です' });
    });

    it('[T-21] extractIndexedIssue_path先頭がnumber以外_undefinedを返す', () => {
        // Arrange
        const issue = { path: ['field'], message: '不正な値です' };

        // Act
        const result = extractIndexedIssue(issue);

        // Assert
        expect(result).toBeUndefined();
    });
});

describe('optionalStringListField', () => {
    it('[T-22] optionalStringListField_文字列_単要素の配列を返す', () => {
        // Act
        const result = optionalStringListField.parse('tokyo');

        // Assert
        expect(result).toEqual(['tokyo']);
    });

    it('[T-23] optionalStringListField_number（先頭ゼロ無しの場所コード相当）_文字列配列に変換する', () => {
        // Arrange: normalizeSearchParams が '31' を number 31 へ自動変換した状態を再現
        // Act
        const result = optionalStringListField.parse(31);

        // Assert
        expect(result).toEqual(['31']);
    });

    it('[T-24] optionalStringListField_number配列_文字列配列に変換する', () => {
        // Act
        const result = optionalStringListField.parse([44, 43]);

        // Assert
        expect(result).toEqual(['44', '43']);
    });

    it('[T-25] optionalStringListField_undefined_undefinedを返す', () => {
        // Act
        const result = optionalStringListField.parse(undefined);

        // Assert
        expect(result).toBeUndefined();
    });
});
