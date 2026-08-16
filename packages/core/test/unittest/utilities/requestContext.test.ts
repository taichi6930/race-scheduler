import { describe, expect, it } from 'bun:test';

import {
    getRequestId,
    isInternalServiceCall,
    resolveRequestId,
    runWithInternalServiceCall,
    runWithRequestId,
} from '@race-schedule/core';

/**
 * requestContext.ts のユニットテスト
 *
 * @spec なし
 *
 * ## デシジョンテーブル: resolveRequestId
 *
 * | #    | headerValue                          | 期待結果                       |
 * |------|---------------------------------------|---------------------------------|
 * | T-01 | undefined                             | 新規UUIDを生成する             |
 * | T-02 | null                                  | 新規UUIDを生成する             |
 * | T-03 | 空文字列                              | 新規UUIDを生成する             |
 * | T-04 | 妥当な形式（英数字・ハイフン）        | そのまま採用する               |
 * | T-05 | 不正な文字を含む（空白等）            | 新規UUIDを生成する             |
 * | T-06 | 256文字超（上限超過）                 | 新規UUIDを生成する             |
 *
 * ## デシジョンテーブル: runWithRequestId / getRequestId
 *
 * | #    | 状況                                   | 期待結果                       |
 * |------|-----------------------------------------|---------------------------------|
 * | T-07 | runWithRequestId のスコープ内           | getRequestId が同じIDを返す    |
 * | T-08 | runWithRequestId のスコープ外           | getRequestId が undefined      |
 * | T-09 | runWithRequestId 内で await を挟む      | 非同期処理を跨いでも同じIDを返す |
 *
 * ## デシジョンテーブル: runWithInternalServiceCall / isInternalServiceCall
 *
 * | #    | 状況                                              | 期待結果 |
 * |------|----------------------------------------------------|----------|
 * | T-10 | runWithInternalServiceCall(true, ...) のスコープ内 | true     |
 * | T-11 | runWithInternalServiceCall のスコープ外            | false    |
 * | T-12 | runWithInternalServiceCall(false, ...) のスコープ内 | false    |
 */
describe('requestContext', () => {
    const UUID_PATTERN =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    describe('resolveRequestId', () => {
        it('resolveRequestId_headerValueがundefined_新規UUIDを生成すること', () => {
            // Arrange & Act
            const result = resolveRequestId(undefined);

            // Assert
            expect(result).toMatch(UUID_PATTERN);
        });

        it('resolveRequestId_headerValueがnull_新規UUIDを生成すること', () => {
            // Arrange & Act
            const result = resolveRequestId(null);

            // Assert
            expect(result).toMatch(UUID_PATTERN);
        });

        it('resolveRequestId_headerValueが空文字列_新規UUIDを生成すること', () => {
            // Arrange & Act
            const result = resolveRequestId('');

            // Assert
            expect(result).toMatch(UUID_PATTERN);
        });

        it('resolveRequestId_妥当な形式のheaderValue_そのまま採用すること', () => {
            // Arrange
            const upstreamId = 'upstream-request-id-123';

            // Act
            const result = resolveRequestId(upstreamId);

            // Assert
            expect(result).toBe(upstreamId);
        });

        it('resolveRequestId_不正な文字を含むheaderValue_新規UUIDを生成すること', () => {
            // Arrange
            const invalid = 'has space/slash';

            // Act
            const result = resolveRequestId(invalid);

            // Assert
            expect(result).toMatch(UUID_PATTERN);
        });

        it('resolveRequestId_256文字超のheaderValue_新規UUIDを生成すること', () => {
            // Arrange
            const tooLong = 'a'.repeat(256);

            // Act
            const result = resolveRequestId(tooLong);

            // Assert
            expect(result).toMatch(UUID_PATTERN);
        });
    });

    describe('runWithRequestId / getRequestId', () => {
        it('getRequestId_runWithRequestIdのスコープ内_同じIDを返すこと', () => {
            // Arrange
            const requestId = 'test-request-id';

            // Act
            const result = runWithRequestId(requestId, () => getRequestId());

            // Assert
            expect(result).toBe(requestId);
        });

        it('getRequestId_runWithRequestIdのスコープ外_undefinedを返すこと', () => {
            // Arrange & Act
            const result = getRequestId();

            // Assert
            expect(result).toBeUndefined();
        });

        it('getRequestId_非同期処理を跨いでも_同じIDを返すこと', async () => {
            // Arrange
            const requestId = 'async-request-id';

            // Act
            const result = await runWithRequestId(requestId, async () => {
                await Promise.resolve();
                return getRequestId();
            });

            // Assert
            expect(result).toBe(requestId);
        });
    });

    describe('runWithInternalServiceCall / isInternalServiceCall', () => {
        it('isInternalServiceCall_trueでrunWithInternalServiceCallのスコープ内_trueを返すこと[T-10]', () => {
            // Arrange & Act
            const result = runWithInternalServiceCall(true, () =>
                isInternalServiceCall(),
            );

            // Assert
            expect(result).toBe(true);
        });

        it('isInternalServiceCall_スコープ外_falseを返すこと[T-11]', () => {
            // Arrange & Act
            const result = isInternalServiceCall();

            // Assert
            expect(result).toBe(false);
        });

        it('isInternalServiceCall_falseでrunWithInternalServiceCallのスコープ内_falseを返すこと[T-12]', () => {
            // Arrange & Act
            const result = runWithInternalServiceCall(false, () =>
                isInternalServiceCall(),
            );

            // Assert
            expect(result).toBe(false);
        });
    });
});
