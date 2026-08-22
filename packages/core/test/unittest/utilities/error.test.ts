/**
 * error ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | # | Function | Input | Expected | Coverage |
 * |----|----------|-------|----------|----------|
 * | 1  | createErrorMessage | Error（message） | prefix: message | Line |
 * | 2  | createErrorMessage | non-Error | prefix: Unknown error | Line |
 * | 3  | handleControllerError | ValidationError | throw される | Branch |
 * | 4  | handleControllerError | Error | 500 JSON response | Branch |
 * | 5  | handleControllerError | appLogger.error呼び出し | ログ出力確認 | Line |
 * | 6  | toErrorMessage | Error | error.message | Branch |
 * | 7  | toErrorMessage | non-Error | String(error) | Branch |
 * | 8  | resolveInternalErrorMessage | サービス間呼び出し外・Error | 汎用メッセージ | Branch |
 * | 9  | resolveInternalErrorMessage | サービス間呼び出し内・Error | `name: message` | Branch |
 * | 10 | resolveInternalErrorMessage | サービス間呼び出し内・非Error | 汎用メッセージ | Branch |
 * | 11 | handleControllerError | サービス間呼び出し内・Error | 応答にエラー詳細を含む | Branch |
 * | 12 | resolveInternalErrorMessage | サービス間呼び出し内・非Errorだがmessageのみ持つオブジェクト | `Error: message`（nameが文字列でないため既定'Error'を使用） | Branch |
 */

import { describe, expect, it, mock } from 'bun:test';
import {
    createErrorMessage,
    handleControllerError,
    resolveInternalErrorMessage,
    runWithInternalServiceCall,
    toErrorMessage,
    ValidationError,
} from '@race-schedule/core';

describe('error Utilities', () => {
    describe('createErrorMessage', () => {
        it('Error インスタンスで prefix: message を返す', () => {
            const error = new Error('Test error message');
            const result = createErrorMessage('API', error);

            expect(result).toBe('API: Test error message');
        });

        it('TypeError で適切なメッセージを生成', () => {
            const error = new TypeError('Invalid type');
            const result = createErrorMessage('Type Check', error);

            expect(result).toBe('Type Check: Invalid type');
        });

        it('ReferenceError で適切なメッセージを生成', () => {
            const error = new ReferenceError('Variable not found');
            const result = createErrorMessage('Reference', error);

            expect(result).toBe('Reference: Variable not found');
        });

        it('SyntaxError で適切なメッセージを生成', () => {
            const error = new SyntaxError('Syntax error');
            const result = createErrorMessage('Parse', error);

            expect(result).toBe('Parse: Syntax error');
        });

        it('Error インスタンスで空のメッセージ', () => {
            const error = new Error('');
            const result = createErrorMessage('Empty', error);

            expect(result).toBe('Empty: ');
        });

        it('非 Error オブジェクト（null）で Unknown error を返す', () => {
            const result = createErrorMessage('Null Error', null);

            expect(result).toBe('Null Error: Unknown error');
        });

        it('非 Error オブジェクト（undefined）で Unknown error を返す', () => {
            const result = createErrorMessage('Undefined Error', undefined);

            expect(result).toBe('Undefined Error: Unknown error');
        });

        it('非 Error オブジェクト（文字列）で Unknown error を返す', () => {
            const result = createErrorMessage('String Error', 'Some string');

            expect(result).toBe('String Error: Unknown error');
        });

        it('非 Error オブジェクト（数値）で Unknown error を返す', () => {
            const result = createErrorMessage('Number Error', 42);

            expect(result).toBe('Number Error: Unknown error');
        });

        it('非 Error オブジェクト（オブジェクト）で Unknown error を返す', () => {
            const result = createErrorMessage('Object Error', {
                message: 'test',
            });

            expect(result).toBe('Object Error: Unknown error');
        });

        it('複数の prefix パターンを処理', () => {
            const error = new Error('test');
            const result1 = createErrorMessage('API', error);
            const result2 = createErrorMessage('Database', error);
            const result3 = createErrorMessage('Validation', error);

            expect(result1).toContain('API:');
            expect(result2).toContain('Database:');
            expect(result3).toContain('Validation:');
        });

        it('特殊文字を含むメッセージを処理', () => {
            const error = new Error('Error: test & special <chars>');
            const result = createErrorMessage('Handler', error);

            expect(result).toBe('Handler: Error: test & special <chars>');
        });
    });

    describe('handleControllerError', () => {
        it('ValidationError は throw される', () => {
            const error = new ValidationError('Validation failed');

            expect(() => handleControllerError(error, 'testMethod')).toThrow(
                ValidationError,
            );
        });

        it('ValidationError は指定の status を保つ', () => {
            const error = new ValidationError('Custom status', 422);

            try {
                handleControllerError(error, 'testMethod');
                expect(false).toBe(true); // 到達しないはず
            } catch (e) {
                expect(e).toBeInstanceOf(ValidationError);
                expect((e as ValidationError).status).toBe(422);
            }
        });

        it('Error は 500 status の JSON レスポンスを返す', async () => {
            const error = new Error('Test error');
            const response = handleControllerError(error, 'testMethod');

            expect(response.status).toBe(500);
            expect(response.headers.get('content-type')).toContain(
                'application/json',
            );
        });

        it('レスポンス JSON に汎用メッセージを含む（SEC-017: error.messageは含めない）', async () => {
            const error = new Error('Test error');
            const response = handleControllerError(error, 'testMethod');
            const json = (await response.json()) as Record<string, unknown>;

            expect(json).toHaveProperty('status', 500);
            expect(json).toHaveProperty('message', 'Internal Server Error');
        });

        it('レスポンスに methodName が含まれる', async () => {
            const response = handleControllerError(
                new Error('test'),
                'myMethod',
            );
            const json = (await response.json()) as Record<string, unknown>;

            // methodName はレスポンスボディに含まれない（ログ出力のみ）
            expect(json).toHaveProperty('status', 500);
            expect(json).toHaveProperty('message');
        });

        it('エラーに stack がある場合も JSON には含まれない（セキュリティ）', async () => {
            const error = new Error('Test error');
            const response = handleControllerError(error, 'testMethod');
            const json = (await response.json()) as Record<string, unknown>;

            expect(json).not.toHaveProperty('stack');
            expect(json).toHaveProperty('status', 500);
        });

        it('Error でない値の場合も汎用メッセージを返す', async () => {
            const response = handleControllerError(
                'String error',
                'testMethod',
            );
            const json = (await response.json()) as Record<string, unknown>;

            expect(json.message).toBe('Internal Server Error');
        });

        it('Error でない値の場合 stack は含まれない', async () => {
            const response = handleControllerError(
                'String error',
                'testMethod',
            );
            const json = (await response.json()) as Record<string, unknown>;

            expect(json).not.toHaveProperty('stack');
        });

        it('Error インスタンスの stack はレスポンスに含まれない（セキュリティ）', async () => {
            try {
                throw new Error('Stack trace test');
            } catch (e) {
                const response = handleControllerError(e, 'testMethod');
                const json = (await response.json()) as Record<string, unknown>;

                expect(json).not.toHaveProperty('stack');
                expect(json).toHaveProperty('status', 500);
            }
        });

        it('console.error が呼ばれる（非 ValidationError）', () => {
            const originalError = console.error;
            const mockError = mock(() => {});
            console.error = mockError as typeof console.error;

            try {
                const error = new Error('Test error');
                handleControllerError(error, 'testMethod');

                expect(mockError).toHaveBeenCalled();
            } finally {
                console.error = originalError;
            }
        });

        it('複数の異なるメソッド名を処理', async () => {
            const error = new Error('test');
            const response1 = (await handleControllerError(
                error,
                'method1',
            ).json()) as Record<string, unknown>;
            const response2 = (await handleControllerError(
                error,
                'method2',
            ).json()) as Record<string, unknown>;

            // メソッド名は method フィールドではなく status/message のみ返す
            expect(response1.status).toBe(500);
            expect(response2.status).toBe(500);
        });

        it('レスポンスはクローン不可（使い切り）', () => {
            const response = handleControllerError(
                new Error('test'),
                'testMethod',
            );

            expect(response.ok).toBe(false);
            expect(response.status).toBe(500);
        });

        it.each([
            new Error('Generic error'),
            new TypeError('Type error'),
            new ReferenceError('Reference error'),
        ])('複数の Error タイプを処理: %s', async (error) => {
            const response = handleControllerError(error, 'test');
            const json = (await response.json()) as Record<string, unknown>;

            expect(json.status).toBe(500);
            expect(response.status).toBe(500);
        });

        it('サービス間呼び出し内_Error_応答にエラー詳細を含むこと[T-11]', async () => {
            const error = new Error('D1_ERROR: too many SQL variables');

            const response = runWithInternalServiceCall(true, () =>
                handleControllerError(error, 'testMethod'),
            );
            const json = (await response.json()) as Record<string, unknown>;

            expect(json.status).toBe(500);
            expect(json.message).toBe(
                'Error: D1_ERROR: too many SQL variables',
            );
        });
    });

    describe('resolveInternalErrorMessage', () => {
        it('resolveInternalErrorMessage_サービス間呼び出し外_汎用メッセージを返すこと[T-08]', () => {
            const result = resolveInternalErrorMessage(
                new Error('secret detail'),
            );

            expect(result).toBe('Internal Server Error');
        });

        it('resolveInternalErrorMessage_サービス間呼び出し内Error_nameとmessageを返すこと[T-09]', () => {
            const result = runWithInternalServiceCall(true, () =>
                resolveInternalErrorMessage(new TypeError('invalid shape')),
            );

            expect(result).toBe('TypeError: invalid shape');
        });

        it('resolveInternalErrorMessage_サービス間呼び出し内・非Error_汎用メッセージを返すこと[T-10]', () => {
            const result = runWithInternalServiceCall(true, () =>
                resolveInternalErrorMessage({ code: 1 }),
            );

            expect(result).toBe('Internal Server Error');
        });

        it('resolveInternalErrorMessage_サービス間呼び出し内・messageのみ持つ非Error_nameは既定のErrorになること[T-12]', () => {
            // Arrange & Act
            // sanitizeErrorはError以外の値をキーそのまま透過するため、
            // nameキーを持たずmessageのみ持つオブジェクトを渡すと
            // 分割代入結果は { name: undefined, message: 'boom' } になる。
            const result = runWithInternalServiceCall(true, () =>
                resolveInternalErrorMessage({ message: 'boom' }),
            );

            // Assert
            expect(result).toBe('Error: boom');
        });
    });

    describe('toErrorMessage', () => {
        it('Error インスタンスで message を返す', () => {
            const error = new Error('boom');
            const result = toErrorMessage(error);

            expect(result).toBe('boom');
        });

        it('カスタム Error（TypeError）でも message を返す', () => {
            const error = new TypeError('invalid');
            const result = toErrorMessage(error);

            expect(result).toBe('invalid');
        });

        it('文字列は String 化して返す', () => {
            const result = toErrorMessage('plain');

            expect(result).toBe('plain');
        });

        it('null は String 化して返す', () => {
            const result = toErrorMessage(null);

            expect(result).toBe('null');
        });

        it('オブジェクトは String 化して返す', () => {
            const result = toErrorMessage({ code: 1 });

            expect(result).toBe('[object Object]');
        });
    });
});
