/**
 * verify-scheduled-workflows.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * cron構文判定を誤ると不正な設定を見逃すため、純粋関数（fs非依存）のUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### extractCronEntries
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | `- cron: "0 6 * * *"` を含むYAML | file/cronを含むエントリ1件 |
 * | T-02 | 複数の `- cron:` 行 | 出現順に全件抽出 |
 * | T-03 | cron行を含まないYAML | 空配列 |
 *
 * ### isValidCronExpression
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-04 | `0 6 * * *` | true |
 * | T-05 | 分フィールドがステップ指定（15分おき） | true |
 * | T-06 | `0 3,9,15,21 * * *`（カンマ区切り） | true |
 * | T-07 | `0 7 * * 1`（曜日指定） | true |
 * | T-08 | `60 * * * *`（分が範囲外） | false |
 * | T-09 | `0 6 * *`（フィールド数不足） | false |
 * | T-10 | `abc * * * *`（数値でない） | false |
 */
import { describe, expect, it } from 'bun:test';

import {
    extractCronEntries,
    isValidCronExpression,
} from './verify-scheduled-workflows';

describe('extractCronEntries', () => {
    it('[T-01] cron行を1件抽出すること', () => {
        const yaml = 'on:\n  schedule:\n    - cron: "0 6 * * *"\n';
        expect(extractCronEntries(yaml, 'a.yml')).toEqual([
            { file: 'a.yml', cron: '0 6 * * *' },
        ]);
    });

    it('[T-02] 複数のcron行を出現順に抽出すること', () => {
        const yaml =
            'on:\n  schedule:\n    - cron: "0 3 * * *"\n    - cron: "0 12 * * *"\n';
        expect(extractCronEntries(yaml, 'a.yml')).toEqual([
            { file: 'a.yml', cron: '0 3 * * *' },
            { file: 'a.yml', cron: '0 12 * * *' },
        ]);
    });

    it('[T-03] cron行が無ければ空配列を返すこと', () => {
        expect(extractCronEntries('on:\n  push:\n', 'a.yml')).toEqual([]);
    });
});

describe('isValidCronExpression', () => {
    it('[T-04] 標準的な日次cronはtrueを返すこと', () => {
        expect(isValidCronExpression('0 6 * * *')).toBe(true);
    });

    it('[T-05] ステップ指定（*/15）はtrueを返すこと', () => {
        expect(isValidCronExpression('*/15 * * * *')).toBe(true);
    });

    it('[T-06] カンマ区切りのリストはtrueを返すこと', () => {
        expect(isValidCronExpression('0 3,9,15,21 * * *')).toBe(true);
    });

    it('[T-07] 曜日指定はtrueを返すこと', () => {
        expect(isValidCronExpression('0 7 * * 1')).toBe(true);
    });

    it('[T-08] 範囲外の値はfalseを返すこと', () => {
        expect(isValidCronExpression('60 * * * *')).toBe(false);
    });

    it('[T-09] フィールド数が5でなければfalseを返すこと', () => {
        expect(isValidCronExpression('0 6 * *')).toBe(false);
    });

    it('[T-10] 数値以外を含む場合はfalseを返すこと', () => {
        expect(isValidCronExpression('abc * * * *')).toBe(false);
    });
});
