import { describe, expect, it } from 'bun:test';

import { splitCsv } from '../../../src/utilities/splitCsv';

/**
 * splitCsv のデシジョンテーブル
 *
 * | #    | 入力                | 期待される出力      | 説明                               |
 * | ---- | ------------------- | -------------------- | ---------------------------------- |
 * | T-01 | `'a,b,c'`           | `['a', 'b', 'c']`     | 通常のカンマ区切り                 |
 * | T-02 | `' a , b '`         | `['a', 'b']`          | 前後の空白を trim する             |
 * | T-03 | `'a,,b,'`           | `['a', 'b']`          | 連続カンマ・末尾カンマの空要素を除去 |
 * | T-04 | `''`                | `[]`                  | 空文字列は空配列                   |
 * | T-05 | `'solo'`            | `['solo']`            | カンマなし単一値                   |
 * | T-06 | `' , a'`            | `['a']`               | 空白のみの要素は trim 後に除去      |
 */
describe('splitCsv', () => {
    it('[T-01] 通常のカンマ区切り: 各要素を配列で返す', () => {
        expect(splitCsv('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('[T-02] 前後に空白を含む: trim された配列を返す', () => {
        expect(splitCsv(' a , b ')).toEqual(['a', 'b']);
    });

    it('[T-03] 連続カンマ・末尾カンマ: 空要素を除去した配列を返す', () => {
        expect(splitCsv('a,,b,')).toEqual(['a', 'b']);
    });

    it('[T-04] 空文字列: 空配列を返す', () => {
        expect(splitCsv('')).toEqual([]);
    });

    it('[T-05] カンマなし単一値: 単一要素の配列を返す', () => {
        expect(splitCsv('solo')).toEqual(['solo']);
    });

    it('[T-06] 空白のみの要素を含む: trim 後に除去した配列を返す', () => {
        expect(splitCsv(' , a')).toEqual(['a']);
    });
});
