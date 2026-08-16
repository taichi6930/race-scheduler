/**
 * UpsertApiResponse 型のテスト
 *
 * `UpsertApiResponse` は `UpsertResult`（`src/utilities/upsertResult.ts`）の型エイリアスに
 * すぎず、独自の実行ロジックを持たない（Q2-10）。そのため、自分で書いたリテラルを
 * 読み返すだけの網羅的な構造検証は行わず、実際に `UpsertResult` を生成する
 * `createEmptyUpsertResult()` の戻り値が `UpsertApiResponse` として代入互換であることのみを
 * 最小限確認する。
 *
 * ## デシジョンテーブル
 *
 * | #    | 入力                                          | 期待結果                                              |
 * |------|-----------------------------------------------|--------------------------------------------------------|
 * | T-01 | createEmptyUpsertResult() の戻り値            | UpsertApiResponse として代入可能・初期値を保持する    |
 * | T-02 | failures を含む実際の UpsertResult            | UpsertApiResponse として代入可能・failures の内容を保持する |
 */

import { describe, expect, it } from 'bun:test';

import type { UpsertApiResponse } from '../../../src/dto/upsertApiResponse';
import { createEmptyUpsertResult } from '../../../src/utilities/upsertResult';

describe('UpsertApiResponse', () => {
    it('[T-01] createEmptyUpsertResultの戻り値_UpsertApiResponseとして代入可能_初期値を保持する', () => {
        // Arrange & Act
        const response: UpsertApiResponse = createEmptyUpsertResult();

        // Assert
        expect(response).toEqual({
            successCount: 0,
            failureCount: 0,
            failures: [],
        });
    });

    it('[T-02] failuresを含む実際のUpsertResult_UpsertApiResponseとして代入可能_failuresの内容を保持する', () => {
        // Arrange
        const upsertResult = {
            ...createEmptyUpsertResult(),
            successCount: 2,
            failureCount: 1,
            failures: [
                { db: 'race_table', id: 'abc123', reason: 'duplicate key' },
            ],
        };

        // Act
        const response: UpsertApiResponse = upsertResult;

        // Assert
        expect(response).toEqual(upsertResult);
        expect(response.failures[0].reason).toBe('duplicate key');
    });
});
