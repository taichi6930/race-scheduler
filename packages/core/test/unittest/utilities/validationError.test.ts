/**
 * ValidationError クラスのテスト
 *
 * ## デシジョンテーブル: ValidationError コンストラクタ
 *
 * | #  | 条件                                         | message              | status | 期待結果                                   |
 * |----|----------------------------------------------|----------------------|--------|---------------------------------------------|
 * |  1 | message のみ指定（status はデフォルト）      | "validation failed"  | -      | status=400, message 保持                   |
 * |  2 | message と status を明示的に指定（400）      | "bad request"        | 400    | status=400, message 保持                   |
 * |  3 | message と status を明示的に指定（422）      | "unprocessable"      | 422    | status=422, message 保持                   |
 * |  4 | message と status を明示的に指定（500）      | "server error"       | 500    | status=500, message 保持                   |
 * |  5 | message が空文字列                           | ""                   | 400    | status=400, message=""                     |
 * |  6 | Error のサブクラスである                     | "any"                | -      | instanceof Error が true                   |
 * |  7 | ValidationError のインスタンスである         | "any"                | -      | instanceof ValidationError が true         |
 * |  8 | name プロパティが "ValidationError" である   | "any"                | -      | error.name === "ValidationError"           |
 * |  9 | status は読み取り専用（readonly）             | -                    | -      | 外部から変更不可                            |
 * | 10 | index は初期状態で undefined                 | "any"                | -      | error.index === undefined                  |
 * | 11 | index を設定できる                           | "any"                | -      | error.index === 設定値                     |
 * | 12 | message に日本語が使える                     | "バリデーションエラー" | 400   | message 保持                               |
 */

import { describe, expect, it } from 'bun:test';

import { ValidationError } from '../../../src/utilities/validationError';

describe('ValidationError', () => {
    // =========================================================================
    // コンストラクタ: status のデフォルト値
    // =========================================================================
    describe('status のデフォルト値', () => {
        it('#1: message のみ指定した場合、status はデフォルト 400 になる', () => {
            const error = new ValidationError('validation failed');

            expect(error.status).toBe(400);
        });

        it('#1: message のみ指定した場合、message が保持される', () => {
            const error = new ValidationError('validation failed');

            expect(error.message).toBe('validation failed');
        });
    });

    // =========================================================================
    // コンストラクタ: status の明示的指定
    // =========================================================================
    describe('status を明示的に指定した場合', () => {
        it('#2: status=400 が正しく設定される', () => {
            const error = new ValidationError('bad request', 400);

            expect(error.status).toBe(400);
        });

        it('#3: status=422 が正しく設定される', () => {
            const error = new ValidationError('unprocessable', 422);

            expect(error.status).toBe(422);
        });

        it('#4: status=500 が正しく設定される', () => {
            const error = new ValidationError('server error', 500);

            expect(error.status).toBe(500);
        });
    });

    // =========================================================================
    // メッセージの検証
    // =========================================================================
    describe('message の検証', () => {
        it('#5: message が空文字列の場合、空文字列が保持される', () => {
            const error = new ValidationError('');

            expect(error.message).toBe('');
            expect(error.status).toBe(400);
        });

        it('#12: message に日本語が使える', () => {
            const error = new ValidationError('バリデーションエラー');

            expect(error.message).toBe('バリデーションエラー');
        });
    });

    // =========================================================================
    // 継承・型の検証
    // =========================================================================
    describe('継承・型の検証', () => {
        it('#6: Error のサブクラスである', () => {
            const error = new ValidationError('any');

            expect(error instanceof Error).toBe(true);
        });

        it('#7: ValidationError のインスタンスである', () => {
            const error = new ValidationError('any');

            expect(error instanceof ValidationError).toBe(true);
        });

        it('#8: name プロパティが "ValidationError" である', () => {
            const error = new ValidationError('any');

            expect(error.name).toBe('ValidationError');
        });
    });

    // =========================================================================
    // index プロパティ
    // =========================================================================
    describe('index プロパティの検証', () => {
        it('#10: index は初期状態で undefined である', () => {
            const error = new ValidationError('any');

            expect(error.index).toBeUndefined();
        });

        it('#11: index に値を設定できる', () => {
            const error = new ValidationError('any');
            error.index = 3;

            expect(error.index).toBe(3);
        });
    });

    // =========================================================================
    // throw/catch の検証
    // =========================================================================
    describe('throw/catch の動作', () => {
        it('throw された ValidationError を catch できる', () => {
            expect(() => {
                throw new ValidationError('test error', 422);
            }).toThrow(ValidationError);
        });

        it('catch した際に message にアクセスできる', () => {
            try {
                throw new ValidationError('catch me', 400);
            } catch (e) {
                expect(e instanceof ValidationError).toBe(true);
                if (e instanceof ValidationError) {
                    expect(e.message).toBe('catch me');
                    expect(e.status).toBe(400);
                }
            }
        });
    });
});
