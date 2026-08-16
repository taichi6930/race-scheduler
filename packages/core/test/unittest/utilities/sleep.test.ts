import { describe, expect, it } from 'bun:test';

import { sleep } from '../../../src/utilities/sleep';

/**
 * sleep のデシジョンテーブル
 *
 * | #    | 入力     | 期待される挙動                                   |
 * | ---- | -------- | ------------------------------------------------- |
 * | T-01 | `ms=10`  | 指定時間経過後に解決する Promise を返す           |
 * | T-02 | `ms=0`   | 即座（次のイベントループ）に解決する              |
 */
describe('sleep', () => {
    it('[T-01] 正の待機時間: 指定時間経過後に解決する', async () => {
        const start = performance.now();

        await sleep(10);

        expect(performance.now() - start).toBeGreaterThanOrEqual(10);
    });

    it('[T-02] 待機時間0: 解決する', async () => {
        await expect(sleep(0)).resolves.toBeUndefined();
    });
});
