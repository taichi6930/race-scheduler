/**
 * chunkArray ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | items          | size | 期待結果                       |
 * |------|----------------|------|----------------------------------|
 * | T-01 | []             | 3    | []（空配列）                     |
 * | T-02 | [1,2,3]        | 5    | [[1,2,3]]（サイズ未満は1チャンク） |
 * | T-03 | [1,2,3,4,5]    | 2    | [[1,2],[3,4],[5]]（端数チャンク） |
 * | T-04 | [1,2,3,4]      | 2    | [[1,2],[3,4]]（ちょうど割り切れる）|
 */
import { describe, expect, it } from 'bun:test';

import { chunkArray } from '../../../../src/repository/utility/chunkArray';

describe('chunkArray', () => {
    it('T-01: 空配列を渡すと空配列を返す', () => {
        const result = chunkArray([], 3);

        expect(result).toEqual([]);
    });

    it('T-02: サイズ未満の配列は1チャンクにまとまる', () => {
        const result = chunkArray([1, 2, 3], 5);

        expect(result).toEqual([[1, 2, 3]]);
    });

    it('T-03: サイズで割り切れない配列は端数チャンクを持つ', () => {
        const result = chunkArray([1, 2, 3, 4, 5], 2);

        expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('T-04: サイズでちょうど割り切れる配列は均等に分割される', () => {
        const result = chunkArray([1, 2, 3, 4], 2);

        expect(result).toEqual([
            [1, 2],
            [3, 4],
        ]);
    });
});
