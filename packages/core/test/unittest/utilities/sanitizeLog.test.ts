/**
 * sanitizeLog.test.ts - sanitizeError のユニットテスト
 *
 * ## デシジョンテーブル（sanitizeError / maskSensitiveFields）
 *
 * | #    | 入力                              | 期待結果                                   |
 * |------|-----------------------------------|--------------------------------------------|
 * | T-01 | Error インスタンス                | name/message/stack を返す                  |
 * | T-02 | Error（開発環境）                 | stack を含む                               |
 * | T-03 | Error（本番環境）                 | stack を先頭フレームのみへ切り詰める（OBS-003） |
 * | T-03b | Error（本番環境、stack未定義）    | stack は undefined のまま                  |
 * | T-04 | 機密キーを含むオブジェクト        | 機密フィールドを [REDACTED] にマスク       |
 * | T-05 | 大文字小文字違いの機密キー        | 大小無視でマスク                           |
 * | T-06 | ネストしたオブジェクト            | 深い階層の機密フィールドもマスク           |
 * | T-07 | 再帰深さ 5 超過                   | 深さ制限によりマスクされない               |
 * | T-08 | 配列内オブジェクト                | 配列要素の機密フィールドをマスク           |
 * | T-09 | プリミティブ（null/undefined/文字列/数値/真偽値） | { message: String(値) } を返す |
 * | T-10 | 空オブジェクト / 空配列           | そのまま返す                               |
 * | T-11 | サービス間認証・Push配信トークン関連キー | マスクする（SECAUTH-11、既存の /token\|auth/i パターンで既にカバーされていることの回帰固定） |
 * | T-12 | メッセージ文字列に `token=xxx` が埋め込まれている | 値のみマスク（SEC-020） |
 * | T-13 | メッセージ文字列に `Authorization: Bearer xxx` が埋め込まれている | 値のみマスク（Bearer は残す、SEC-020） |
 * | T-14 | メッセージ文字列に複数の `token=`/`auth=` が混在 | すべて値のみマスク（SEC-020） |
 * | T-15 | トークンを含まない通常の文章（`単語:` を含むが機密キーではない） | マスクされずそのまま残る（SEC-020） |
 * | T-16 | `auth`/`token` を部分文字列として含むだけの通常の英単語（authenticate/unauthorized） | 単語境界一致のため誤マスクしない（SEC-020） |
 * | T-17 | ネストしたオブジェクトの文字列値に埋め込まれたトークン | 値のみマスク（SEC-020） |
 * | T-18 | Error でないプリミティブ文字列に埋め込まれたトークン | 値のみマスク（SEC-020） |
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { sanitizeError } from '@race-schedule/core';

describe('sanitizeError', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    describe('Error オブジェクト', () => {
        it('sanitizeError_Errorインスタンス_name_message_stackを返すこと', () => {
            // Arrange
            const error = new Error('Test error message');

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(result).toEqual({
                name: 'Error',
                message: 'Test error message',
                stack: expect.any(String),
            });
        });

        it('sanitizeError_開発環境_stackを含めること', () => {
            // Arrange
            process.env.NODE_ENV = 'development';
            const error = new Error('Dev error');

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(typeof result.stack).toBe('string');
        });

        it('sanitizeError_本番環境_stackを先頭フレームのみへ切り詰めること', () => {
            // Arrange
            process.env.NODE_ENV = 'production';
            const error = new Error('Prod error');
            // 実行環境依存でスタック行数が変動しないよう、深い呼び出し履歴を
            // 持つ多行スタックを明示的に用意する。
            error.stack = [
                'Error: Prod error',
                '    at innerFn (/app/src/deep/inner.ts:10:5)',
                '    at middleFn (/app/src/deep/middle.ts:20:3)',
                '    at outerFn (/app/src/index.ts:5:1)',
            ].join('\n');

            // Act
            const result = sanitizeError(error);

            // Assert
            const resultStack = result.stack as string;
            expect(typeof resultStack).toBe('string');
            expect(resultStack.split('\n')).toEqual([
                'Error: Prod error',
                '    at innerFn (/app/src/deep/inner.ts:10:5)',
            ]);
            expect(resultStack).not.toContain('middleFn');
            expect(resultStack).not.toContain('outerFn');
        });

        it('sanitizeError_本番環境かつstack未定義_stackはundefinedのままであること', () => {
            // Arrange
            process.env.NODE_ENV = 'production';
            const error = new Error('No stack');
            error.stack = undefined;

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(result.stack).toBeUndefined();
        });

        it('sanitizeError_TypeError_nameとmessageを保持すること', () => {
            // Arrange
            const error = new TypeError('Invalid type');

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(result.name).toBe('TypeError');
            expect(result.message).toBe('Invalid type');
        });
    });

    describe('機密フィールドのマスク', () => {
        it('sanitizeError_privateKeyを含むオブジェクト_マスクすること', () => {
            // Arrange
            const obj = { name: 'app', privateKey: 'secret-key-value' };

            // Act
            const result = sanitizeError(obj);

            // Assert
            expect(result.privateKey).toBe('[REDACTED]');
            expect(result.name).toBe('app');
        });

        it('sanitizeError_各種機密キー_すべてマスクすること', () => {
            // Arrange
            const obj = {
                apiSecret: 'x',
                password: 'x',
                api_key: 'x',
                access_key: 'x',
                authorization_token: 'x',
                credentials: 'x',
                auth_token: 'x',
                publicInfo: 'visible',
            };

            // Act
            const result = sanitizeError(obj);

            // Assert
            expect(result.apiSecret).toBe('[REDACTED]');
            expect(result.password).toBe('[REDACTED]');
            expect(result.api_key).toBe('[REDACTED]');
            expect(result.access_key).toBe('[REDACTED]');
            expect(result.authorization_token).toBe('[REDACTED]');
            expect(result.credentials).toBe('[REDACTED]');
            expect(result.auth_token).toBe('[REDACTED]');
            expect(result.publicInfo).toBe('visible');
        });

        it('sanitizeError_サービス間認証・Push配信トークン関連キー_マスクすること', () => {
            // Arrange: service-auth-design.md §5 Stage 4（SECAUTH-11）が明示的に
            // マスク対象へ追加を要求したキー名。既存の /token/i・/auth/i パターンで
            // 既にマッチするが、将来パターンを変更した際の回帰を検知できるよう
            // 明示的にケースを固定する。
            const obj = {
                'X-Service-Auth-Token': 'service-token-value',
                SERVICE_AUTH_TOKEN: 'service-token-value',
                'X-Push-Dispatch-Token': 'push-token-value',
                PUSH_DISPATCH_TOKEN: 'push-token-value',
                publicInfo: 'visible',
            };

            // Act
            const result = sanitizeError(obj);

            // Assert
            expect(result['X-Service-Auth-Token']).toBe('[REDACTED]');
            expect(result.SERVICE_AUTH_TOKEN).toBe('[REDACTED]');
            expect(result['X-Push-Dispatch-Token']).toBe('[REDACTED]');
            expect(result.PUSH_DISPATCH_TOKEN).toBe('[REDACTED]');
            expect(result.publicInfo).toBe('visible');
        });

        it('sanitizeError_大文字小文字違いの機密キー_大小無視でマスクすること', () => {
            // Arrange
            const obj = {
                PrivateKey: 'key1',
                PRIVATE_KEY: 'key2',
                private_key: 'key3',
            };

            // Act
            const result = sanitizeError(obj);

            // Assert
            expect(result.PrivateKey).toBe('[REDACTED]');
            expect(result.PRIVATE_KEY).toBe('[REDACTED]');
            expect(result.private_key).toBe('[REDACTED]');
        });
    });

    describe('ネスト・配列', () => {
        it('sanitizeError_ネストしたオブジェクト_深い階層の機密をマスクすること', () => {
            // Arrange
            const obj = {
                user: {
                    name: 'John',
                    password: 'secret123',
                    profile: { email: 'john@example.com', apiKey: 'key-xyz' },
                },
            };

            // Act
            const result = sanitizeError(obj);

            // Assert
            interface NestedUser {
                name: string;
                password: string;
                profile: { email: string; apiKey: string };
            }
            const user = result.user as NestedUser;
            expect(user.password).toBe('[REDACTED]');
            expect(user.profile.apiKey).toBe('[REDACTED]');
            expect(user.profile.email).toBe('john@example.com');
        });

        it('sanitizeError_再帰深さ5超過_マスクされないこと', () => {
            // Arrange
            const obj = {
                l1: { l2: { l3: { l4: { l5: { l6: { privateKey: 'x' } } } } } },
            };

            // Act
            const result = sanitizeError(obj);

            // Assert
            interface DeepChain {
                l2: { l3: { l4: { l5: { l6: { privateKey: string } } } } };
            }
            const l5 = (result.l1 as DeepChain).l2.l3.l4.l5;
            expect(l5.l6.privateKey).toBe('x');
        });

        it('sanitizeError_配列内オブジェクト_機密フィールドをマスクすること', () => {
            // Arrange
            const arr = [
                { name: 'user1', password: 'pass1' },
                { name: 'user2', password: 'pass2' },
            ];

            // Act
            const result = sanitizeError(arr);

            // Assert
            const maskedArr = result as unknown as {
                name: string;
                password: string;
            }[];
            expect(Array.isArray(result)).toBe(true);
            expect(maskedArr[0].password).toBe('[REDACTED]');
            expect(maskedArr[0].name).toBe('user1');
        });
    });

    describe('プリミティブ値', () => {
        it('sanitizeError_null_messageにnull文字列を返すこと', () => {
            expect(sanitizeError(null)).toEqual({ message: 'null' });
        });

        it('sanitizeError_undefined_messageにundefined文字列を返すこと', () => {
            expect(sanitizeError(undefined)).toEqual({ message: 'undefined' });
        });

        it('sanitizeError_文字列_messageにその文字列を返すこと', () => {
            expect(sanitizeError('error message')).toEqual({
                message: 'error message',
            });
        });

        it('sanitizeError_数値_messageに数値文字列を返すこと', () => {
            expect(sanitizeError(123)).toEqual({ message: '123' });
        });

        it('sanitizeError_boolean_messageに真偽文字列を返すこと', () => {
            expect(sanitizeError(true)).toEqual({ message: 'true' });
        });
    });

    describe('エッジケース', () => {
        it('sanitizeError_空オブジェクト_空オブジェクトを返すこと', () => {
            expect(sanitizeError({})).toEqual({});
        });

        it('sanitizeError_空配列_空配列を返すこと', () => {
            const result = sanitizeError([]);

            expect(Array.isArray(result)).toBe(true);
            expect((result as unknown as unknown[]).length).toBe(0);
        });

        it('sanitizeError_機密でないプリミティブ値を含むオブジェクト_値を透過すること', () => {
            // Arrange
            const obj = { count: 3, flag: false, note: 'ok' };

            // Act
            const result = sanitizeError(obj);

            // Assert
            expect(result).toEqual({ count: 3, flag: false, note: 'ok' });
        });
    });

    describe('文字列値への埋め込みトークンのマスク（SEC-020）', () => {
        it('sanitizeError_メッセージにtoken=形式の値が埋め込まれている_値のみマスクすること', () => {
            // Arrange: T-12
            const error = new Error('Failed to call API: token=abcDEF123456');

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(result.message).toBe('Failed to call API: token=[REDACTED]');
        });

        it('sanitizeError_メッセージにAuthorizationBearer形式の値が埋め込まれている_値のみマスクすること', () => {
            // Arrange: T-13
            const error = new Error(
                'Request failed. Authorization: Bearer abcDEF123456',
            );

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(result.message).toBe(
                'Request failed. Authorization: Bearer [REDACTED]',
            );
        });

        it('sanitizeError_メッセージに複数のtokenとauthの値が混在_すべてマスクすること', () => {
            // Arrange: T-14
            const error = new Error(
                'sync failed: token=aaa111bbb222, auth=ccc333ddd444',
            );

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(result.message).toBe(
                'sync failed: token=[REDACTED], auth=[REDACTED]',
            );
        });

        it('sanitizeError_機密キーではない単語にコロンが続く通常の文章_マスクされずそのまま残ること', () => {
            // Arrange: T-15
            const error = new Error(
                'Failed to fetch race schedule: network timeout',
            );

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(result.message).toBe(
                'Failed to fetch race schedule: network timeout',
            );
        });

        it('sanitizeError_authを部分文字列として含むだけの通常の英単語_誤ってマスクしないこと', () => {
            // Arrange: T-16（"authenticate"/"unauthorized" は /auth/i の部分一致対象だが、
            // 単語単位では独立した "auth" というキーではないため誤マスクしないことを確認する）
            const error = new Error(
                'User must authenticate: please retry after unauthorized access',
            );

            // Act
            const result = sanitizeError(error);

            // Assert
            expect(result.message).toBe(
                'User must authenticate: please retry after unauthorized access',
            );
        });

        it('sanitizeError_ネストしたオブジェクトの文字列値に埋め込まれたトークン_値のみマスクすること', () => {
            // Arrange: T-17
            const obj = {
                detail: 'upstream call failed: apiKey=zzzZZZ999',
            };

            // Act
            const result = sanitizeError(obj);

            // Assert
            expect(result.detail).toBe(
                'upstream call failed: apiKey=[REDACTED]',
            );
        });

        it('sanitizeError_Errorでないプリミティブ文字列に埋め込まれたトークン_値のみマスクすること', () => {
            // Arrange: T-18

            // Act
            const result = sanitizeError('login failed: password=hunter2plus');

            // Assert
            expect(result.message).toBe('login failed: password=[REDACTED]');
        });
    });
});
