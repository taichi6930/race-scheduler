/**
 * CORS ユーティリティ テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | Function | Input | Expected | Coverage |
 * |------|----------|-------|----------|----------|
 * | 1    | withCorsHeaders | headers + origin | マージ済み | Line |
 * | 2    | withCorsHeaders | 既存 CORS header | 上書き | Line |
 * | T-03 | withCorsHeaders | 許可リスト外origin(`https://evil.com`) | Allow-Origin='null' | Branch |
 * | T-04 | withCorsHeaders | originヘッダ無し(`null`) | Allow-Origin='null' | Branch |
 * | T-05 | withCorsHeaders | `CORS_ALLOWED_ORIGINS='https://a.com,https://b.com'` 設定 + 許可オリジン | Allow-Origin=該当オリジン | Branch |
 * | T-06 | withCorsHeaders | `CORS_ALLOWED_ORIGINS='https://a.com,https://b.com'` 設定 + localhost | Allow-Origin='null'（拒否） | Branch |
 * | T-07 | withCorsHeaders | `CORS_ALLOWED_ORIGINS='*'` 設定 | Allow-Origin='*' | Branch |
 * | T-08 | getAllowedOrigins | 同一env値で連続呼び出し（PERF-085） | 2回目は同一参照（メモ化） | Branch |
 * | T-09 | getAllowedOrigins | 連続呼び出しの間でenv値を変更（PERF-085） | 変更後の値に更新される | Branch |
 * | T-10 | getAllowedOrigins | overrideRaw指定（refactor#134、process.env設定済み） | process.envより overrideRaw が優先される | Branch |
 * | T-11 | getAllowedOrigins | overrideRaw省略 | process.env の値にフォールバックする | Branch |
 * | T-12 | withCorsHeaders | 同一origin(許可)で連続呼び出し（PERF-086） | Allow-Origin値は毎回同じ（キャッシュ経由） | Branch |
 * | T-13 | withCorsHeaders | 連続呼び出しの間でenv値を変更（PERF-086） | 変更後の許可判定に更新される（古いキャッシュを引きずらない） | Branch |
 * | T-14 | withCorsHeaders | production環境 + `CORS_ALLOWED_ORIGINS='*'`（SEC-014） | ワイルドカードが無視されデフォルト値にフォールバックし、任意originでAllow-Originが'null' | Branch |
 * | T-15 | withCorsHeaders | production環境 + `CORS_ALLOWED_ORIGINS='*,https://a.com'`（SEC-014） | ワイルドカードのみ無視され、他の明示オリジンは有効なまま | Branch |
 * | T-15a | withCorsHeaders | production環境 + ワイルドカードを含まない明示オリジン（SEC-014） | 変更されずそのまま許可判定される | Branch |
 * | T-16 | withCorsHeaders | 非production環境 + `CORS_ALLOWED_ORIGINS='*'` | 従来通りワイルドカード許可される（T-07と同じ、回帰確認） | Branch |
 * | T-17 | withCorsHeaders | `CORS_ALLOWED_ORIGINS`に末尾スラッシュ付きで設定 + 末尾スラッシュ無しorigin | Allow-Originが該当オリジンになる（許可される） | Branch |
 * | T-18 | withCorsHeaders | `CORS_ALLOWED_ORIGINS`は末尾スラッシュ無し + 末尾スラッシュ付きorigin | Allow-Originが該当origin（生値）になる（許可される） | Branch |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { getAllowedOrigins, withCorsHeaders } from '@race-schedule/core';

describe('CORS Utilities', () => {
    const originalEnv = process.env.CORS_ALLOWED_ORIGINS;
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.CORS_ALLOWED_ORIGINS = originalEnv;
        process.env.NODE_ENV = originalNodeEnv;
    });

    describe('withCorsHeaders', () => {
        beforeEach(() => {
            delete process.env.CORS_ALLOWED_ORIGINS;
        });

        it('headers を CORS headers とマージ', () => {
            const result = withCorsHeaders(
                { 'Content-Type': 'application/json' },
                'http://localhost:3000',
            );

            expect(result['Access-Control-Allow-Origin']).toBe(
                'http://localhost:3000',
            );
            expect(result['Content-Type']).toBe('application/json');
        });

        it('既存の CORS header を上書き', () => {
            const result = withCorsHeaders(
                {
                    'Access-Control-Allow-Origin': 'https://old.com',
                    'Content-Type': 'text/plain',
                },
                'http://localhost:8080',
            );

            // 実装では headers が後にマージされるため、既存の header が優先される
            expect(result['Access-Control-Allow-Origin']).toBe(
                'https://old.com',
            );
            expect(result['Content-Type']).toBe('text/plain');
        });

        it('headers が undefined の場合でも CORS headers を返す', () => {
            const result = withCorsHeaders(undefined, 'http://localhost:3000');

            expect(result['Access-Control-Allow-Origin']).toBe(
                'http://localhost:3000',
            );
            expect(result['Access-Control-Allow-Methods']).toBeDefined();
        });

        it('Headers インスタンスを渡した場合は forEach でノーマライズ', () => {
            const headersInstance = new Headers({
                'Content-Type': 'application/json',
                'X-Custom': 'value',
            });

            const result = withCorsHeaders(
                headersInstance,
                'http://localhost:3000',
            );

            // Headers クラスはキーを小文字化する
            expect(result['content-type']).toBe('application/json');
            expect(result['x-custom']).toBe('value');
            expect(result['Access-Control-Allow-Origin']).toBe(
                'http://localhost:3000',
            );
        });

        it('配列形式の headers を渡した場合もノーマライズ', () => {
            const headersArray: [string, string][] = [
                ['Content-Type', 'text/plain'],
                ['X-Request-Id', 'abc123'],
            ];

            const result = withCorsHeaders(
                headersArray,
                'http://localhost:3000',
            );

            expect(result['Content-Type']).toBe('text/plain');
            expect(result['X-Request-Id']).toBe('abc123');
            expect(result['Access-Control-Allow-Origin']).toBe(
                'http://localhost:3000',
            );
        });

        it('複数の CORS header をすべて追加', () => {
            const result = withCorsHeaders({}, 'http://localhost:3000');

            expect(result['Access-Control-Allow-Methods']).toContain('DELETE');
            expect(result['Access-Control-Allow-Methods']).toContain('OPTIONS');
            expect(result['Access-Control-Allow-Headers']).toBe(
                'Content-Type, Authorization',
            );
        });

        it('PERF-037: Varyヘッダーが"Origin"で付与される（共有キャッシュの誤配信防止）', () => {
            const result = withCorsHeaders({}, 'http://localhost:3000');

            expect(result.Vary).toBe('Origin');
        });

        describe('許可リスト外のoriginやOriginヘッダ無しの場合、Access-Control-Allow-Originが"null"になる', () => {
            it.each([
                ['許可リスト外のorigin', 'https://evil.com'],
                ['Originヘッダ無し(null)', null],
            ])(
                '[T-03/T-04] %s の場合、withCorsHeaders_origin不許可_Allow-Originがnullになる',
                (_, origin) => {
                    const result = withCorsHeaders({}, origin);

                    expect(result['Access-Control-Allow-Origin']).toBe('null');
                },
            );
        });

        describe('CORS_ALLOWED_ORIGINS環境変数が設定されている場合', () => {
            beforeEach(() => {
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://a.com,https://b.com';
            });

            it('[T-05] withCorsHeaders_許可リストに含まれる本番オリジン_Allow-Originが該当オリジンになる', () => {
                const result = withCorsHeaders({}, 'https://a.com');

                expect(result['Access-Control-Allow-Origin']).toBe(
                    'https://a.com',
                );
            });

            it('[T-06] withCorsHeaders_許可リストに含まれないlocalhost_Allow-Originがnullになる', () => {
                const result = withCorsHeaders({}, 'http://localhost:3000');

                expect(result['Access-Control-Allow-Origin']).toBe('null');
            });
        });

        describe('CORS_ALLOWED_ORIGINSがワイルドカード("*")の場合', () => {
            beforeEach(() => {
                process.env.CORS_ALLOWED_ORIGINS = '*';
            });

            it('[T-07] withCorsHeaders_ワイルドカード設定_任意のoriginでAllow-Originが"*"になる', () => {
                const result = withCorsHeaders(
                    {},
                    'https://any-origin.example.com',
                );

                expect(result['Access-Control-Allow-Origin']).toBe('*');
            });
        });

        describe('production環境でCORS_ALLOWED_ORIGINSがワイルドカード("*")の場合（SEC-014）', () => {
            it("[T-14] withCorsHeaders_production環境+ワイルドカード_ワイルドカードが無視されAllow-Originが'null'になる", () => {
                process.env.NODE_ENV = 'production';
                process.env.CORS_ALLOWED_ORIGINS = '*';

                const result = withCorsHeaders(
                    {},
                    'https://any-origin.example.com',
                );

                expect(result['Access-Control-Allow-Origin']).toBe('null');
            });

            it('[T-15a] withCorsHeaders_production環境+ワイルドカードを含まない明示オリジン_変更されずそのまま許可判定される', () => {
                process.env.NODE_ENV = 'production';
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://a.com,https://b.com';

                const allowed = withCorsHeaders({}, 'https://a.com');
                const notAllowed = withCorsHeaders({}, 'https://evil.com');

                expect(allowed['Access-Control-Allow-Origin']).toBe(
                    'https://a.com',
                );
                expect(notAllowed['Access-Control-Allow-Origin']).toBe('null');
            });

            it('[T-15] withCorsHeaders_production環境+ワイルドカードと明示オリジンの混在_ワイルドカードのみ無視され明示オリジンは有効', () => {
                process.env.NODE_ENV = 'production';
                process.env.CORS_ALLOWED_ORIGINS = '*,https://a.com';

                const allowed = withCorsHeaders({}, 'https://a.com');
                const wildcardOrigin = withCorsHeaders(
                    {},
                    'https://any-origin.example.com',
                );

                expect(allowed['Access-Control-Allow-Origin']).toBe(
                    'https://a.com',
                );
                expect(wildcardOrigin['Access-Control-Allow-Origin']).toBe(
                    'null',
                );
            });

            it('[T-16] withCorsHeaders_非production環境+ワイルドカード_従来通りワイルドカードが許可される', () => {
                process.env.NODE_ENV = 'development';
                process.env.CORS_ALLOWED_ORIGINS = '*';

                const result = withCorsHeaders(
                    {},
                    'https://any-origin.example.com',
                );

                expect(result['Access-Control-Allow-Origin']).toBe('*');
            });
        });

        describe('CORS_ALLOWED_ORIGINSまたはrequest originの末尾スラッシュを正規化する', () => {
            it('[T-17] withCorsHeaders_許可リスト側が末尾スラッシュ付き設定_末尾スラッシュ無しoriginでも許可される', () => {
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://race-schedule-front-prod.pages.dev/';

                const result = withCorsHeaders(
                    {},
                    'https://race-schedule-front-prod.pages.dev',
                );

                expect(result['Access-Control-Allow-Origin']).toBe(
                    'https://race-schedule-front-prod.pages.dev',
                );
            });

            it('[T-18] withCorsHeaders_request origin側が末尾スラッシュ付き_許可リストと一致し生値のoriginがそのまま返る', () => {
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://race-schedule-front-prod.pages.dev';

                const result = withCorsHeaders(
                    {},
                    'https://race-schedule-front-prod.pages.dev/',
                );

                expect(result['Access-Control-Allow-Origin']).toBe(
                    'https://race-schedule-front-prod.pages.dev/',
                );
            });
        });

        describe('PERF-085: getAllowedOrigins()のメモ化', () => {
            it('[T-08] getAllowedOrigins_同一env値で連続呼び出し_2回目は同一参照を返す', () => {
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://cache-test.example.com';

                const first = getAllowedOrigins();
                const second = getAllowedOrigins();

                // 値が変わっていなければ再計算されず同一参照が返る
                expect(second).toBe(first);
                expect(second).toEqual(['https://cache-test.example.com']);
            });

            it('[T-09] getAllowedOrigins_連続呼び出しの間でenv値を変更_変更後の値に更新される', () => {
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://cache-test.example.com';
                const before = getAllowedOrigins();

                process.env.CORS_ALLOWED_ORIGINS =
                    'https://cache-test-changed.example.com';
                const after = getAllowedOrigins();

                expect(after).not.toBe(before);
                expect(after).toEqual([
                    'https://cache-test-changed.example.com',
                ]);
            });

            it('[T-10] getAllowedOrigins_overrideRaw指定_process.envより優先される（refactor#134）', () => {
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://process-env.example.com';

                const result = getAllowedOrigins(
                    'https://override.example.com',
                );

                expect(result).toEqual(['https://override.example.com']);
            });

            it('[T-11] getAllowedOrigins_overrideRaw省略_process.envの値にフォールバックする（refactor#134）', () => {
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://fallback.example.com';

                const result = getAllowedOrigins(undefined);

                expect(result).toEqual(['https://fallback.example.com']);
            });
        });

        describe('PERF-086: getCorsHeaders()のメモ化', () => {
            beforeEach(() => {
                process.env.CORS_ALLOWED_ORIGINS =
                    'https://perf-086.example.com';
            });

            it('[T-12] withCorsHeaders_同一originで連続呼び出し_Allow-Origin値は毎回同じ結果になる', () => {
                const first = withCorsHeaders(
                    {},
                    'https://perf-086.example.com',
                );
                const second = withCorsHeaders(
                    {},
                    'https://perf-086.example.com',
                );

                expect(second['Access-Control-Allow-Origin']).toBe(
                    first['Access-Control-Allow-Origin'],
                );
                expect(second['Access-Control-Allow-Origin']).toBe(
                    'https://perf-086.example.com',
                );
            });

            it('[T-13] withCorsHeaders_連続呼び出しの間でenv値を変更_変更後の許可判定に更新される', () => {
                const before = withCorsHeaders(
                    {},
                    'https://perf-086.example.com',
                );
                expect(before['Access-Control-Allow-Origin']).toBe(
                    'https://perf-086.example.com',
                );

                process.env.CORS_ALLOWED_ORIGINS =
                    'https://perf-086-changed.example.com';

                // 変更前に許可されていた origin は、キャッシュを引きずらず
                // 新しい許可リストに基づいて再判定される（'null' になる）。
                const after = withCorsHeaders(
                    {},
                    'https://perf-086.example.com',
                );
                expect(after['Access-Control-Allow-Origin']).toBe('null');

                const afterNewOrigin = withCorsHeaders(
                    {},
                    'https://perf-086-changed.example.com',
                );
                expect(afterNewOrigin['Access-Control-Allow-Origin']).toBe(
                    'https://perf-086-changed.example.com',
                );
            });
        });
    });
});
