/**
 * errorHandler.test.ts - handleApiError のユニットテスト
 *
 * ## デシジョンテーブル（handleApiError）
 *
 * SEC-017: クライアント応答の message は常に汎用固定文字列（'Internal Server Error'）。
 * error の内容（詳細メッセージ）はログにのみ残り、応答には含まれない。
 *
 * | #    | error            | 期待する message              | status | 副作用                     |
 * |------|------------------|-------------------------------|--------|----------------------------|
 * | T-01 | Error オブジェクト | 'Internal Server Error'（固定） | 500    | appLogger.error 呼び出し   |
 * | T-02 | 文字列           | 'Internal Server Error'（固定） | 500    | appLogger.error 呼び出し   |
 * | T-03 | 非Errorオブジェクト | 'Internal Server Error'（固定） | 500    | appLogger.error 呼び出し   |
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock, spyOn } from 'bun:test';
import { appLogger } from '@race-schedule/core';
import type { Context } from 'hono';

import { handleApiError } from '../../../src/utility/errorHandler';

interface MockContext {
    json: Mock<(body: unknown, status?: number) => Response>;
}

const createMockContext = (): MockContext => ({
    json: mock(
        (body: unknown, status?: number) =>
            new Response(JSON.stringify(body), { status }),
    ),
});

describe('handleApiError', () => {
    it('[T-01] handleApiError_Errorオブジェクト_汎用メッセージで500を返すこと', () => {
        // Arrange
        const logSpy = spyOn(appLogger, 'error').mockImplementation(() => {});
        const c = createMockContext();

        // Act
        const response = handleApiError(
            c as unknown as Context,
            new Error('boom'),
        );

        // Assert
        expect(c.json).toHaveBeenCalledWith(
            {
                status: 500,
                message: 'Internal Server Error',
                code: 'INTERNAL_ERROR',
            },
            500,
        );
        expect(response.status).toBe(500);
        expect(logSpy).toHaveBeenCalledTimes(1);

        logSpy.mockRestore();
    });

    it('[T-02] handleApiError_文字列_汎用メッセージで500を返すこと', () => {
        // Arrange
        const logSpy = spyOn(appLogger, 'error').mockImplementation(() => {});
        const c = createMockContext();

        // Act
        handleApiError(c as unknown as Context, 'plain failure');

        // Assert
        expect(c.json).toHaveBeenCalledWith(
            {
                status: 500,
                message: 'Internal Server Error',
                code: 'INTERNAL_ERROR',
            },
            500,
        );

        logSpy.mockRestore();
    });

    it('[T-03] handleApiError_非Errorオブジェクト_汎用メッセージで500を返すこと', () => {
        // Arrange
        const logSpy = spyOn(appLogger, 'error').mockImplementation(() => {});
        const c = createMockContext();

        // Act
        handleApiError(c as unknown as Context, { code: 42 });

        // Assert
        expect(c.json).toHaveBeenCalledWith(
            {
                status: 500,
                message: 'Internal Server Error',
                code: 'INTERNAL_ERROR',
            },
            500,
        );

        logSpy.mockRestore();
    });
});
