/**
 * errorResponse.test.ts - ルーター層 500 エラーレスポンスのユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### internalErrorResponseBody（SEC-017: クライアント応答は常に汎用メッセージ）
 * | #    | 期待 body                                                    |
 * |------|---------------------------------------------------------------|
 * | B-01 | { status:500, message:'Internal Server Error', code:'INTERNAL_ERROR' }（error内容によらず固定、QAPI-08） |
 *
 * ### internalErrorResponse
 * | #    | 期待                                             |
 * |------|--------------------------------------------------|
 * | R-01 | status 500・JSON body（汎用メッセージ）・CORS ヘッダー付与 |
 *
 * ### logInternalError
 * | #    | error                | 期待                                                                                                    |
 * |------|----------------------|----------------------------------------------------------------------------------------------------------|
 * | L-01 | Error                | `appLogger.error` が `(logMessage, sanitizeError(error))` で呼ばれ、戻り値が汎用メッセージのボディと一致すること（error.messageはログにのみ残り応答には含まれない） |
 * | L-02 | 非Errorオブジェクト  | `appLogger.error` の第2引数が `sanitizeError(error)`（機密フィールドマスク済みオブジェクト）と一致すること   |
 * | L-03 | Error（サービス間呼び出し内） | 応答ボディにエラー詳細を含むこと                                                             |
 */

import { describe, expect, it, spyOn } from 'bun:test';
import {
    appLogger,
    internalErrorResponse,
    internalErrorResponseBody,
    logInternalError,
    runWithInternalServiceCall,
    sanitizeError,
} from '@race-schedule/core';

describe('internalErrorResponseBody', () => {
    it('internalErrorResponseBody_常に汎用メッセージを載せること[B-01]', () => {
        // Act
        const body = internalErrorResponseBody();

        // Assert
        expect(body).toEqual({
            status: 500,
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
        });
    });
});

describe('internalErrorResponse', () => {
    it('internalErrorResponse_status500のJSONレスポンスを返すこと[R-01]', async () => {
        // Act
        const response = internalErrorResponse();

        // Assert
        expect(response.status).toBe(500);
        expect(response.headers.get('content-type')).toContain(
            'application/json',
        );
        const body = (await response.json()) as Record<string, unknown>;
        expect(body).toEqual({
            status: 500,
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
        });
    });

    it('internalErrorResponse_CORSヘッダーを付与すること', () => {
        // Act
        const response = internalErrorResponse();

        // Assert
        expect(
            response.headers.get('Access-Control-Allow-Methods'),
        ).toBeTruthy();
    });
});

describe('logInternalError', () => {
    it('logInternalError_Error_appLoggerErrorがsanitizeError済み引数で呼ばれ戻り値が汎用メッセージのボディと一致すること[L-01]', () => {
        // Arrange
        const errorSpy = spyOn(appLogger, 'error').mockImplementation(() => {});
        const error = new Error('boom');

        // Act
        const body = logInternalError('API error', error);

        // Assert
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0]?.[0]).toBe('API error');
        expect(errorSpy.mock.calls[0]?.[1]).toEqual(sanitizeError(error));
        expect(body).toEqual(internalErrorResponseBody());
        // error.message（'boom'）が応答ボディに含まれないこと（SEC-017）
        expect(body.message).not.toContain('boom');

        errorSpy.mockRestore();
    });

    it('logInternalError_非Errorオブジェクト_appLoggerErrorの第2引数がsanitizeError済みオブジェクトであること[L-02]', () => {
        // Arrange
        const errorSpy = spyOn(appLogger, 'error').mockImplementation(() => {});
        const error = { code: 42, password: 'secret-value' };

        // Act
        const body = logInternalError('batch error', error);

        // Assert
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0]?.[0]).toBe('batch error');
        expect(errorSpy.mock.calls[0]?.[1]).toEqual(sanitizeError(error));
        // sanitizeError によって password フィールドがマスクされていることも合わせて確認
        expect(
            (errorSpy.mock.calls[0]?.[1] as Record<string, unknown>).password,
        ).toBe('[REDACTED]');
        expect(body).toEqual(internalErrorResponseBody());

        errorSpy.mockRestore();
    });

    it('logInternalError_サービス間呼び出し内Error_応答ボディにエラー詳細を含むこと[L-03]', () => {
        // Arrange
        const errorSpy = spyOn(appLogger, 'error').mockImplementation(() => {});
        const error = new Error('D1_ERROR: too many SQL variables');

        // Act
        const body = runWithInternalServiceCall(true, () =>
            logInternalError('API error', error),
        );

        // Assert
        expect(body).toEqual({
            status: 500,
            message: 'Error: D1_ERROR: too many SQL variables',
            code: 'INTERNAL_ERROR',
        });

        errorSpy.mockRestore();
    });
});
