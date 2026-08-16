/**
 * entityUpsertErrorResponse.test.ts
 *
 * ## デシジョンテーブル: entityUpsertParseErrorResponse
 *
 * | #    | error の種別                          | index の有無 | 期待結果                                      |
 * |------|----------------------------------------|--------------|------------------------------------------------|
 * | T-01 | ValidationError                        | あり（number）| 400, { status, message, errors:[{index,reason}] } |
 * | T-02 | ValidationError                        | なし          | badRequest(message, status)                     |
 * | T-03 | Error（ValidationError以外）           | -            | badRequest(message)                             |
 * | T-04 | Error以外の値（string）                | -            | badRequest('Invalid request body')              |
 */

import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@race-schedule/core';

import { entityUpsertParseErrorResponse } from '../../../../src/controller/utility/entityUpsertErrorResponse';

describe('entityUpsertParseErrorResponse', () => {
    it('[T-01] ValidationError_indexあり_errors配列付きの400を返す', async () => {
        // Arrange
        const error = new ValidationError('不正な値です', 400);
        error.index = 2;

        // Act
        const response = entityUpsertParseErrorResponse(error);
        const body = (await response.json()) as {
            status: number;
            message: string;
            errors: { index: number; reason: string }[];
        };

        // Assert
        expect(response.status).toBe(400);
        expect(body).toEqual({
            status: 400,
            message: '不正な値です',
            errors: [{ index: 2, reason: '不正な値です' }],
        });
    });

    it('[T-02] ValidationError_indexなし_badRequestを返す', async () => {
        // Arrange
        const error = new ValidationError('必須項目が不足しています', 422);

        // Act
        const response = entityUpsertParseErrorResponse(error);
        const body = (await response.json()) as {
            status: number;
            message: string;
            code: string;
        };

        // Assert
        expect(response.status).toBe(422);
        expect(body).toEqual({
            status: 422,
            message: '必須項目が不足しています',
            // QAPI-08: 422はERROR_CODE_BY_STATUSに未登録のためERRORにフォールバック
            code: 'ERROR',
        });
    });

    it('[T-03] ValidationError以外のError_badRequestを返す', async () => {
        // Arrange
        const error = new Error('想定外のエラー');

        // Act
        const response = entityUpsertParseErrorResponse(error);
        const body = (await response.json()) as {
            status: number;
            message: string;
            code: string;
        };

        // Assert
        expect(response.status).toBe(400);
        expect(body).toEqual({
            status: 400,
            message: '想定外のエラー',
            code: 'BAD_REQUEST',
        });
    });

    it('[T-04] Error以外の値_Invalid_request_bodyのbadRequestを返す', async () => {
        // Arrange
        const error = 'not an Error instance';

        // Act
        const response = entityUpsertParseErrorResponse(error);
        const body = (await response.json()) as {
            status: number;
            message: string;
            code: string;
        };

        // Assert
        expect(response.status).toBe(400);
        expect(body).toEqual({
            status: 400,
            message: 'Invalid request body',
            code: 'BAD_REQUEST',
        });
    });
});
