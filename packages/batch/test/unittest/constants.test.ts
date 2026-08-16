/**
 * constants テスト
 *
 * ## デシジョンテーブル
 *
 * | # | 定数名                  | 期待値               | Coverage       |
 * |----|-------------------------|----------------------|----------------|
 * | 1  | FETCH_TIMEOUT_MS        | 300_000              | 正常系・値確認 |
 * | 2  | LIGHT_FETCH_TIMEOUT_MS  | 30_000               | 正常系・値確認（PERF-080） |
 */

import { describe, expect, it } from 'bun:test';

import { FETCH_TIMEOUT_MS, LIGHT_FETCH_TIMEOUT_MS } from '../../src/constants';

describe('constants', () => {
    it('FETCH_TIMEOUT_MS_5分をミリ秒で表した値(300000)', () => {
        // Arrange & Act & Assert
        expect(FETCH_TIMEOUT_MS).toBe(300_000);
    });

    it('LIGHT_FETCH_TIMEOUT_MS_30秒をミリ秒で表した値(30000)', () => {
        // Arrange & Act & Assert
        expect(LIGHT_FETCH_TIMEOUT_MS).toBe(30_000);
    });
});
