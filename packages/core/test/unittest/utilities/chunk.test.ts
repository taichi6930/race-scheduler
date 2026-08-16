/**
 * chunk ユーティリティ テスト
 *
 * ## デシジョンテーブル（chunkArray）
 *
 * | # | 条件 | Input | Expected | Coverage |
 * |----|------|-------|----------|----------|
 * | 1  | 正常系 | items.length <= chunkSize | 1チャンクにまとめる | Line |
 * | 2  | 正常系 | items.length > chunkSize | 複数チャンクに分割する | Line |
 * | 3  | 正常系 | 空配列 | 空配列を返す | Branch |
 *
 * ## デシジョンテーブル（mergeUpsertApiResponses）
 *
 * | # | 条件 | Input | Expected | Coverage |
 * |----|------|-------|----------|----------|
 * | 1  | 正常系 | 複数レスポンス | successCount/failureCount/failuresを合算 | Line |
 * | 2  | 正常系 | 空配列 | 空のUpsertResultを返す | Branch |
 *
 * ## デシジョンテーブル（resolveChunkSize）
 *
 * | # | 条件 | Input | Expected | Coverage |
 * |----|------|-------|----------|----------|
 * | 1  | 正常系 | 環境変数未設定 | defaultValueを返す | Branch |
 * | 2  | 正常系 | 環境変数に正の整数 | その値を返す | Line |
 * | 3  | 異常系 | 環境変数が0以下 | defaultValueにフォールバック | Branch |
 * | 4  | 異常系 | 環境変数が数値以外 | defaultValueにフォールバック | Branch |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
    chunkArray,
    mergeUpsertApiResponses,
    resolveChunkSize,
} from '@race-schedule/core';

describe('chunkArray', () => {
    it('#1: items.lengthがchunkSize以下の場合1チャンクにまとめる', () => {
        expect(chunkArray([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    });

    it('#2: items.lengthがchunkSizeを超える場合複数チャンクに分割する', () => {
        expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('#3: 空配列の場合空配列を返す', () => {
        expect(chunkArray([], 5)).toEqual([]);
    });
});

describe('mergeUpsertApiResponses', () => {
    it('#1: 複数レスポンスのsuccessCount/failureCount/failuresを合算する', () => {
        const result = mergeUpsertApiResponses([
            {
                successCount: 1,
                failureCount: 1,
                failures: [{ db: 'race', id: 'a', reason: 'x' }],
            },
            {
                successCount: 2,
                failureCount: 0,
                failures: [],
            },
        ]);

        expect(result).toEqual({
            successCount: 3,
            failureCount: 1,
            failures: [{ db: 'race', id: 'a', reason: 'x' }],
        });
    });

    it('#2: 空配列の場合空のUpsertResultを返す', () => {
        expect(mergeUpsertApiResponses([])).toEqual({
            successCount: 0,
            failureCount: 0,
            failures: [],
        });
    });
});

describe('resolveChunkSize', () => {
    const ENV_VAR_NAME = 'TEST_CHUNK_SIZE';

    beforeEach(() => {
        delete process.env[ENV_VAR_NAME];
    });

    afterEach(() => {
        delete process.env[ENV_VAR_NAME];
    });

    it('#1: 環境変数未設定の場合defaultValueを返す', () => {
        expect(resolveChunkSize(ENV_VAR_NAME, 500)).toBe(500);
    });

    it('#2: 環境変数に正の整数が設定されている場合その値を返す', () => {
        process.env[ENV_VAR_NAME] = '10';

        expect(resolveChunkSize(ENV_VAR_NAME, 500)).toBe(10);
    });

    it('#3: 環境変数が0以下の場合defaultValueにフォールバックする', () => {
        process.env[ENV_VAR_NAME] = '0';

        expect(resolveChunkSize(ENV_VAR_NAME, 500)).toBe(500);
    });

    it('#4: 環境変数が数値以外の場合defaultValueにフォールバックする', () => {
        process.env[ENV_VAR_NAME] = 'not-a-number';

        expect(resolveChunkSize(ENV_VAR_NAME, 500)).toBe(500);
    });
});
