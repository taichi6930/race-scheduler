/**
 * runRateLimited.test.ts - runRateLimited 共通ヘルパーのユニットテスト
 *
 * ## デシジョンテーブル（runRateLimited）
 *
 * | #    | items       | concurrency | task     | 期待結果                                             |
 * |------|-------------|-------------|----------|------------------------------------------------------|
 * | T-01 | 空配列      | 2           | -        | task/onResult 未呼び出し                             |
 * | T-02 | 2件         | 2           | 成功     | 1チャンクで実行・onResult が fulfilled で2回          |
 * | T-03 | 3件         | 2           | 成功     | 2チャンク（待機分岐 true→false 両方を通過）           |
 * | T-04 | 1件         | 1           | reject   | onResult が rejected で呼ばれる                       |
 * | T-05 | 3件         | 2           | delayMs=500 | チャンク間の setTimeout が500msで1回呼ばれる       |
 */
import 'reflect-metadata';

import { describe, expect, it, mock, spyOn } from 'bun:test';

import { runRateLimited } from '../../../../src/repository/utility/runRateLimited';

describe('runRateLimited', () => {
    it('runRateLimited_items空配列_taskを呼ばないこと', async () => {
        // Arrange
        const task = mock(async (item: number) => item);
        const onResult = mock(() => {});

        // Act
        await runRateLimited<number, number>(
            [],
            { concurrency: 2, delayMs: 0 },
            task,
            onResult,
        );

        // Assert
        expect(task).not.toHaveBeenCalled();
        expect(onResult).not.toHaveBeenCalled();
    });

    it('runRateLimited_2件concurrency2_1チャンクでonResultをfulfilledで2回呼ぶこと', async () => {
        // Arrange
        const task = mock(async (item: number) => item * 10);
        const statuses: string[] = [];
        const onResult = mock((result: PromiseSettledResult<number>) => {
            statuses.push(result.status);
        });

        // Act
        await runRateLimited<number, number>(
            [1, 2],
            { concurrency: 2, delayMs: 0 },
            task,
            onResult,
        );

        // Assert
        expect(task).toHaveBeenCalledTimes(2);
        expect(statuses).toEqual(['fulfilled', 'fulfilled']);
    });

    it('runRateLimited_3件concurrency2_2チャンクに分割し待機分岐を両方通過すること', async () => {
        // Arrange
        const task = mock(async (item: number) => item);
        const onResult = mock(() => {});

        // Act
        await runRateLimited<number, number>(
            [1, 2, 3],
            { concurrency: 2, delayMs: 0 },
            task,
            onResult,
        );

        // Assert
        expect(task).toHaveBeenCalledTimes(3);
        expect(onResult).toHaveBeenCalledTimes(3);
    });

    it('runRateLimited_taskがreject_onResultをrejectedで呼ぶこと', async () => {
        // Arrange
        const task = mock(async () => {
            throw new Error('rate limited');
        });
        let captured: PromiseSettledResult<number> | undefined;
        const onResult = mock((result: PromiseSettledResult<number>) => {
            captured = result;
        });

        // Act
        await runRateLimited<number, number>(
            [1],
            { concurrency: 1, delayMs: 0 },
            task,
            onResult,
        );

        // Assert
        expect(captured?.status).toBe('rejected');
    });

    it('runRateLimited_delayMsが非ゼロ_チャンク間でsetTimeoutが指定ミリ秒で呼ばれること', async () => {
        // Arrange
        const task = mock(async (item: number) => item);
        const onResult = mock(() => {});
        const setTimeoutSpy = spyOn(
            globalThis,
            'setTimeout',
        ).mockImplementation(((callback: () => void) => {
            callback();
            return 0 as unknown as Timer;
        }) as unknown as typeof setTimeout);

        try {
            // Act
            await runRateLimited<number, number>(
                [1, 2, 3],
                { concurrency: 2, delayMs: 500 },
                task,
                onResult,
            );

            // Assert
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(setTimeoutSpy.mock.calls[0][1]).toBe(500);
        } finally {
            setTimeoutSpy.mockRestore();
        }
    });
});
