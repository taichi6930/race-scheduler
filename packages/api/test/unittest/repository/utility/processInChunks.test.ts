/**
 * processInChunks.test.ts - processInChunks 共通ヘルパーのユニットテスト
 *
 * ## デシジョンテーブル（processInChunks）
 *
 * | #    | items       | chunkSize | processChunk | 期待結果                                       |
 * |------|-------------|-----------|--------------|------------------------------------------------|
 * | T-01 | 空配列      | 2         | -            | processChunk/onChunkError 未呼び出し           |
 * | T-02 | 2件         | 2         | 成功         | processChunk が1回・全件を1チャンクで受け取る   |
 * | T-03 | 3件         | 2         | 成功         | processChunk が2回（境界で分割）               |
 * | T-04 | 2件         | 2         | throw        | onChunkError が呼ばれ例外を伝播しない          |
 * | T-05 | 3件         | 2         | 2回目のみthrow | 失敗チャンクのみ onChunkError・処理は継続      |
 */
import 'reflect-metadata';

import { describe, expect, it, mock } from 'bun:test';

import { processInChunks } from '../../../../src/repository/utility/processInChunks';

describe('processInChunks', () => {
    it('processInChunks_items空配列_processChunkを呼ばないこと', async () => {
        // Arrange
        const processChunk = mock(async () => {});
        const onChunkError = mock(() => {});

        // Act
        await processInChunks<number>([], 2, processChunk, onChunkError);

        // Assert
        expect(processChunk).not.toHaveBeenCalled();
        expect(onChunkError).not.toHaveBeenCalled();
    });

    it('processInChunks_2件chunkSize2_1チャンクで全件を処理すること', async () => {
        // Arrange
        const received: number[][] = [];
        const processChunk = mock(async (chunk: number[]) => {
            received.push(chunk);
        });
        const onChunkError = mock(() => {});

        // Act
        await processInChunks<number>([1, 2], 2, processChunk, onChunkError);

        // Assert
        expect(processChunk).toHaveBeenCalledTimes(1);
        expect(received).toEqual([[1, 2]]);
        expect(onChunkError).not.toHaveBeenCalled();
    });

    it('processInChunks_3件chunkSize2_境界で2チャンクに分割すること', async () => {
        // Arrange
        const received: number[][] = [];
        const processChunk = mock(async (chunk: number[]) => {
            received.push(chunk);
        });
        const onChunkError = mock(() => {});

        // Act
        await processInChunks<number>([1, 2, 3], 2, processChunk, onChunkError);

        // Assert
        expect(processChunk).toHaveBeenCalledTimes(2);
        expect(received).toEqual([[1, 2], [3]]);
    });

    it('processInChunks_processChunkがthrow_onChunkErrorを呼び例外を伝播しないこと', async () => {
        // Arrange
        const failure = new Error('chunk failed');
        const processChunk = mock(async () => {
            throw failure;
        });
        const onChunkError = mock((_chunk: number[], _error: unknown) => {});

        // Act & Assert
        await expect(
            processInChunks<number>([1, 2], 2, processChunk, onChunkError),
        ).resolves.toBeUndefined();
        expect(onChunkError).toHaveBeenCalledTimes(1);
        expect(onChunkError.mock.calls[0]).toEqual([[1, 2], failure]);
    });

    it('processInChunks_一部チャンクのみthrow_失敗チャンクのみonChunkErrorし処理を継続すること', async () => {
        // Arrange
        const okChunks: number[][] = [];
        const processChunk = mock(async (chunk: number[]) => {
            if (chunk.includes(3)) {
                throw new Error('boom');
            }
            okChunks.push(chunk);
        });
        const onChunkError = mock(() => {});

        // Act
        await processInChunks<number>([1, 2, 3], 2, processChunk, onChunkError);

        // Assert
        expect(processChunk).toHaveBeenCalledTimes(2);
        expect(okChunks).toEqual([[1, 2]]);
        expect(onChunkError).toHaveBeenCalledTimes(1);
    });
});
