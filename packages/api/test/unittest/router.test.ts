/**
 * Router テスト（API）
 *
 * @spec SPEC-API-001
 *
 * ## C1デシジョンテーブル（API Router）
 *
 * | #  | Path        | Method  | Preflight | Route Exists | Allowed Method | Expected Status     | CORS | 備考                      |
 * |----|-------------|---------|-----------|--------------|----------------|---------------------|------|---------------------------|
 * | 1  | /health     | GET     | No        | Yes          | GET            | 200                 | Yes  | 正常系（D1疎通成功、OBS-017） |
 * | 2  | /place      | OPTIONS | Yes       | Yes          | OPTIONS        | 204                 | Yes  | CORSプリフライト          |
 * | 3  | /place      | GET     | No        | Yes          | GET            | 200                 | Yes  | place取得(正常系・DI環境あり) |
 * | 4  | /race       | GET     | No        | Yes          | GET            | 200                 | Yes  | race取得(正常系・DI環境あり) |
 * | 5  | /not-found  | GET     | No        | No           | -              | 404                 | Yes  | 存在しないパス            |
 * | 6  | /place      | DELETE  | No        | Yes          | Not Allowed    | 404                 | Yes  | 未サポートメソッド（GET/POSTのみ登録） |
 * | 6b | /place      | PUT     | No        | Yes          | Not Allowed    | 404                 | Yes  | 未サポートメソッド（GET/POSTのみ登録） |
 * | 8  | /race       | OPTIONS | Yes       | Yes          | OPTIONS        | 200                 | Yes  | CORSプリフライト(race)     |
 * | 9  | /health     | OPTIONS | Yes       | Yes          | OPTIONS        | 200                 | Yes  | CORSプリフライト(health)   |
 * | 10 | /calendar/flag | GET  | No        | Yes          | GET            | 200                 | Yes  | 指定レースフラグ一覧取得   |
 * | 11 | /calendar/flag | POST | No        | Yes          | POST           | 200                 | Yes  | 指定レースフラグ追加       |
 * | 12 | /calendar/flag | DELETE | No      | Yes          | DELETE         | 200                 | Yes  | 指定レースフラグ削除       |
 * | 13 | /push/subscription | POST | No   | Yes          | POST           | 200                 | Yes  | Push購読登録              |
 * | 14 | /push/subscription | POST | No   | Yes          | POST           | 400                 | Yes  | Push購読登録（不正body）  |
 * | 15 | /push/subscription | DELETE | No  | Yes          | DELETE         | 200                 | Yes  | Push購読解除              |
 * | 16 | /push/request | POST | No        | Yes          | POST           | 200                 | Yes  | Push発火予約登録          |
 * | 17 | /push/request | POST | No        | Yes          | POST           | 400                 | Yes  | Push発火予約登録（不正raceId）|
 * | 18 | /push/request | DELETE | No      | Yes          | DELETE         | 200                 | Yes  | Push発火予約取消          |
 * | 19 | /push/dispatch | POST | No      | Yes          | POST           | 401                 | Yes  | Pushディスパッチ（トークン不正） |
 * | 20 | /race/calendar-event | GET | No | Yes          | GET            | 404                 | Yes  | カレンダーイベントプレビュー（該当レースなし） |
 * | 21 | /race/calendar-event | GET | No | Yes          | GET            | 400                 | Yes  | カレンダーイベントプレビュー（raceId欠落） |
 * | 22 | /push/test  | POST    | No        | Yes          | POST           | 200                 | Yes  | Pushテスト送信（購読なし） |
 * | 23 | /race/docs  | GET     | No        | Yes          | GET            | 200 + Cache-Control | Yes  | PERF-033: サブパスにもキャッシュヘッダーが伝播すること |
 * | 24 | /place/docs | GET     | No        | Yes          | GET            | 200 + Cache-Control | Yes  | PERF-033: サブパスにもキャッシュヘッダーが伝播すること |
 * | 25 | /calendar/flag | GET  | No        | Yes          | GET            | 200 + Cache-Control | Yes  | PERF-034: 一覧取得にCache-Controlが設定されること |
 * | 26 | /calendar/flag | POST | No        | Yes          | POST           | 200 (Cache-Controlなし) | Yes | PERF-034: 更新系にはCache-Controlを設定しないこと |
 * | 27 | /player     | GET     | No        | Yes          | GET            | 200 + Cache-Control(no-store) | Yes | PERF-036/KPLAYER-07回帰: priorityの変更が即座に反映されるようキャッシュ自体を無効化すること |
 * | 28 | /health     | GET     | No        | Yes          | GET            | 200 + X-Request-Id  | Yes  | QERR-06: 正常系にもX-Request-Idヘッダーが付与されること |
 * | 29 | /race/calendar-event | GET | No | Yes          | GET            | 400 + X-Request-Id  | Yes  | QERR-06: エラー応答にもX-Request-Idヘッダーが付与されること |
 * | 30 | /health     | GET     | No        | Yes          | GET            | 200 + X-Request-Id（伝搬） | Yes | QERR-06: リクエストの X-Request-Id が渡された場合、そのまま応答に引き継がれること |
 * | 31 | /player     | POST    | No        | Yes          | POST           | 401ではない          | Yes  | KPLAYER-07回帰: サービス認証ヘッダー無しでも401にならないこと（front由来の注目選手登録のため） |
 * | 32 | /health     | GET     | No        | Yes          | GET            | 200 + Cache-Control(no-store) | Yes | CFCACHE-09: 監視対象のためヘッダー無しによる中間キャッシュの発見的挙動を避け明示的に無効化すること |
 * | 33 | /ui/race-detail | GET | No        | Yes          | GET            | 404                 | Yes  | レース詳細UIスキーマ（該当レースなし） |
 * | 34 | /ui/race-detail | GET | No        | Yes          | GET            | 400                 | Yes  | レース詳細UIスキーマ（raceId欠落） |
 *
 * テストは上記ケースを検証し、ルーティングとCORSの設定が期待どおりであることを確認します。
 *
 * - ルーティングの基本確認 (/place, /race, /health)
 * - CORS preflight ハンドリング (OPTIONS)
 * - 404 ハンドリング
 * - 未サポートメソッドの挙動
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { isExempt, SERVICE_AUTH_HEADER } from '@race-schedule/core';

import { router, SERVICE_AUTH_EXEMPT_ROUTES } from '../../src/router';
import { createInMemoryD1Database } from '../common/inMemoryD1';
import {
    buildMockHonoEnv,
    MOCK_SERVICE_AUTH_TOKEN,
} from '../common/mockHonoEnv';
import { setupGlobalMocks } from '../common/setupGlobalMocks';

/** 保護対象ルート向けに、サービス間認証ヘッダーを付与したヘッダーを組み立てる */
const authHeaders = (
    extra?: Record<string, string>,
): Record<string, string> => ({
    ...extra,
    [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
});

let mockHonoEnv: ReturnType<typeof buildMockHonoEnv>;

describe('API Router', () => {
    beforeEach(() => {
        const db = createInMemoryD1Database();
        mockHonoEnv = buildMockHonoEnv(db);
        setupGlobalMocks(db);
        // テスト環境では CORS をワイルドカード許可
        process.env.CORS_ALLOWED_ORIGINS = '*';
    });
    describe('GET /health', () => {
        it('ヘルスチェックが正常に動作すること', async () => {
            // OBS-017: /healthはD1へping（SELECT 1）するようになったため、
            // c.env（D1バインディング）を持つmockHonoEnvを渡す必要がある。
            const request = new Request('http://localhost:8787/health', {
                method: 'GET',
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);

            // QAPI-06: /health をJSON形式にし、稼働中Workerのビルド情報を
            // 判別できるようにした（4 Worker横断で形状を揃える）。
            const body = await response.json();
            expect(body).toEqual({ status: 'ok', package: 'api' });
        });

        it('D1への疎通に失敗した場合503を返すこと', async () => {
            // Arrange: DB.prepareが例外を投げるモックenvを用意する
            interface FailingDB {
                prepare: (sql: string) => { first: () => Promise<never> };
            }
            const failingEnv = {
                ...mockHonoEnv,
                DB: {
                    prepare: () => ({
                        first: () =>
                            Promise.reject(new Error('D1 connection lost')),
                    }),
                } satisfies FailingDB,
            };
            const request = new Request('http://localhost:8787/health', {
                method: 'GET',
            });

            // Act
            const response = await router.fetch(request, failingEnv);

            // Assert
            expect(response.status).toBe(503);
            const body = await response.json();
            expect(body).toEqual({
                status: 'ng',
                package: 'api',
                reason: 'D1 unreachable',
            });
        });

        it('CORS headersが設定されていること', async () => {
            const request = new Request('http://localhost:8787/health', {
                method: 'GET',
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
                '*',
            );
            // Honoはデフォルトでメソッドヘッダーを設定しない場合がある
            // Origin ヘッダーが設定されていることを確認
            expect(response.headers.has('Access-Control-Allow-Origin')).toBe(
                true,
            );
        });
    });

    describe('X-Request-Id ヘッダー（QERR-06）', () => {
        it('28: 正常系のレスポンスにX-Request-Idヘッダーが付与されること', async () => {
            const request = new Request('http://localhost:8787/health', {
                method: 'GET',
            });

            const response = await router.fetch(request, mockHonoEnv);

            expect(response.headers.get('X-Request-Id')).toBeTruthy();
        });

        it('29: エラー応答（400）にもX-Request-Idヘッダーが付与されること', async () => {
            const request = new Request(
                'http://localhost:8787/race/calendar-event',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);

            expect(response.status).toBe(400);
            expect(response.headers.get('X-Request-Id')).toBeTruthy();
        });

        it('30: リクエストのX-Request-Idヘッダーがそのまま応答に引き継がれること', async () => {
            const request = new Request('http://localhost:8787/health', {
                method: 'GET',
                headers: { 'X-Request-Id': 'incoming-request-id-123' },
            });

            const response = await router.fetch(request, mockHonoEnv);

            expect(response.headers.get('X-Request-Id')).toBe(
                'incoming-request-id-123',
            );
        });
    });

    describe('OPTIONS (CORS preflight)', () => {
        it('/place へのOPTIONSリクエストが正常に処理されること', async () => {
            const request = new Request('http://localhost:8787/place', {
                method: 'OPTIONS',
            });

            const response = await router.fetch(request);
            // Hono の CORS ミドルウェアは OPTIONS プリフライトに常に 204 を返す
            expect(response.status).toBe(204);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
                '*',
            );
        });
    });

    describe('GET /place', () => {
        it('placeエンドポイントがルーティングされ空データで200を返すこと', async () => {
            const request = new Request(
                'http://localhost:8787/place?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=JRA',
                { method: 'GET' },
            );

            // InMemoryDBは各テストで空の状態から始まるため、正常系は決定的に200になる
            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
                '*',
            );
        });
    });

    describe('GET /race', () => {
        it('raceエンドポイントがルーティングされ空データで200を返すこと', async () => {
            // searchRaceFilterParamsSchemaが要求するstartDate/finishDate/raceTypeListを指定する
            // （旧クエリのplaceIdListはこのエンドポイントのスキーマに存在しない不正パラメータだった）
            const request = new Request(
                'http://localhost:8787/race?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=JRA',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
                '*',
            );
        });
    });

    describe('GET /race/calendar-event', () => {
        it('該当レースが存在しない場合404を返すこと', async () => {
            const request = new Request(
                'http://localhost:8787/race/calendar-event?raceId=jra202601010101',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(404);
        });

        it('raceIdが指定されていない場合400を返すこと', async () => {
            const request = new Request(
                'http://localhost:8787/race/calendar-event',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(400);
        });
    });

    describe('GET /ui/race-detail', () => {
        it('該当レースが存在しない場合404を返すこと', async () => {
            const request = new Request(
                'http://localhost:8787/ui/race-detail?raceId=jra202601010101',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(404);
        });

        it('raceIdが指定されていない場合400を返すこと', async () => {
            const request = new Request(
                'http://localhost:8787/ui/race-detail',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(400);
        });
    });

    describe('404 Not Found', () => {
        it('存在しないパスは404を返すこと', async () => {
            // deny-by-defaultのため未登録パスも保護対象。純粋なルーティングの
            // 404を検証するため認証済みリクエストを送る。
            const request = new Request('http://localhost:8787/not-found', {
                method: 'GET',
                headers: authHeaders(),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(404);

            const text = await response.text();
            // Hono は "404 Not Found" を返す
            expect(text).toContain('Not Found');
        });

        it('404でもCORS headersが設定されていること', async () => {
            const request = new Request('http://localhost:8787/not-found', {
                method: 'GET',
            });

            const response = await router.fetch(request);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
                '*',
            );
        });
    });

    describe('Unsupported methods', () => {
        // /place にはGET/POSTのみ登録されており（registerCrud）、DELETE/PUTは
        // Honoのルーティングに一致しないため404 Not Foundになる。
        // 旧テストはPOSTを「想定外メソッド」として使っていたが、POSTは
        // registerCrud経由でupsertとして実際にサポートされているため
        // 未サポートメソッドの検証になっていなかった（テスト名と実挙動の矛盾）。
        it('DELETE /place が未登録メソッドとして404を返すこと', async () => {
            const request = new Request('http://localhost:8787/place', {
                method: 'DELETE',
                headers: authHeaders(),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(404);
        });

        it('PUT /place が未登録メソッドとして404を返すこと', async () => {
            const request = new Request('http://localhost:8787/place', {
                method: 'PUT',
                headers: authHeaders(),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(404);
        });
    });

    describe('GET /calendar', () => {
        it('calendarエンドポイントがルーティングされること', async () => {
            const request = new Request(
                'http://localhost:8787/calendar?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=jra',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
                '*',
            );
        });
    });

    describe('POST /calendar', () => {
        it('POST /calendar は廃止されており404を返すこと', async () => {
            // Google Calendarへの同期はcalendar Workerが担うため、
            // apiのPOST /calendar（旧upsert）は廃止した。GETのみ残る。
            const request = new Request('http://localhost:8787/calendar', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify([]),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(404);
        });
    });

    describe('GET /calendar/flag', () => {
        it('calendar/flagエンドポイント(一覧取得)がルーティングされること', async () => {
            const request = new Request('http://localhost:8787/calendar/flag', {
                method: 'GET',
                headers: authHeaders(),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
                '*',
            );
        });
    });

    describe('POST /calendar/flag', () => {
        it('calendar/flagエンドポイント(フラグ追加)がルーティングされること', async () => {
            const request = new Request('http://localhost:8787/calendar/flag', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ raceId: 'jra202601010101' }),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
        });
    });

    describe('DELETE /calendar/flag', () => {
        it('calendar/flagエンドポイント(フラグ削除)がルーティングされること', async () => {
            const request = new Request('http://localhost:8787/calendar/flag', {
                method: 'DELETE',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ raceId: 'jra202601010101' }),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
        });
    });

    describe('POST /race', () => {
        it('race POSTエンドポイントが空配列を拒否し400を返すこと', async () => {
            // parseRaceEntityUpsertは空配列を「配列は1件以上必要です」で拒否する
            // （実装上決定的に400になる。任意の妥当なRaceEntityを送るケースは
            // 別途repository層のUTでupsert成功系を検証済みのため、ここではルーティング＋
            // 入力検証の疎通確認に留める）
            const request = new Request('http://localhost:8787/race', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify([]),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(400);
        });
    });

    describe('GET /player', () => {
        it('playerエンドポイントがルーティングされ空データで200を返すこと', async () => {
            // searchPlayerFilterParamsSchemaはraceTypeListのみを受け付ける(.strict())ため、
            // startDate/finishDateを含めると「Unrecognized keys」で400になってしまう。
            // 正常系を決定的に検証するためraceTypeListのみを指定する。
            const request = new Request(
                'http://localhost:8787/player?raceTypeList=jra',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
        });
    });

    describe('POST /player', () => {
        it('player POSTエンドポイントが空配列を拒否し400を返すこと', async () => {
            // parsePlayerEntityUpsertは空配列を「配列は1件以上必要です」で拒否する
            // （#2001でplace/raceと対称の.min(1)制約が追加され、決定的に400になる）
            const request = new Request('http://localhost:8787/player', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify([]),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(400);
        });

        it('KPLAYER-07回帰_サービス認証ヘッダーを付けなくても401にならないこと', async () => {
            // front（player_remote_data_source.dart の upsertPlayers）は
            // サービス認証トークンを持たないため、認証ヘッダー無しでリクエストする。
            // 以前はSERVICE_AUTH_EXEMPT_ROUTESへの登録漏れで401になり、
            // 注目選手の登録/解除ボタンが機能しなかった（本テストはその回帰防止）。
            const request = new Request('http://localhost:8787/player', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([]),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).not.toBe(401);
        });
    });

    describe('GET /debug/database', () => {
        it('debug/databaseエンドポイントがルーティングされること', async () => {
            const request = new Request(
                'http://localhost:8787/debug/database',
                { method: 'GET', headers: authHeaders() },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
        });

        describe('production環境（SEC-023）', () => {
            const originalNodeEnv = process.env.NODE_ENV;

            afterEach(() => {
                process.env.NODE_ENV = originalNodeEnv;
            });

            it('USE_IN_MEMORY_DBがtrueでもproduction環境なら404を返すこと', async () => {
                process.env.NODE_ENV = 'production';
                const request = new Request(
                    'http://localhost:8787/debug/database',
                    { method: 'GET', headers: authHeaders() },
                );

                const response = await router.fetch(request, mockHonoEnv);

                expect(response.status).toBe(404);
                const body = await response.json<{
                    success: boolean;
                    message: string;
                }>();
                expect(body).toEqual({ success: false, message: 'Not Found' });
            });
        });
    });

    describe('ボディサイズ制限', () => {
        it('1MBを超えるリクエストボディが413を返すこと', async () => {
            // 1MB + 1 バイトを超えるペイロードを送信（Content-Length ヘッダーで明示）
            const largeBody = 'x'.repeat(1024 * 1024 + 1);
            const request = new Request('http://localhost:8787/place', {
                method: 'POST',
                headers: authHeaders({
                    'Content-Type': 'text/plain',
                    'Content-Length': String(largeBody.length),
                }),
                body: largeBody,
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(413);
            const json = await response.json<{ status: number }>();
            expect(json.status).toBe(413);
        });
    });

    describe('POST /push/subscription', () => {
        it('push/subscriptionエンドポイント(購読登録)がルーティングされること', async () => {
            const request = new Request(
                'http://localhost:8787/push/subscription',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpoint: 'https://push.example.com/subscription/abc',
                        keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
                    }),
                },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
        });

        it('bodyが不正な場合は400を返すこと', async () => {
            const request = new Request(
                'http://localhost:8787/push/subscription',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: 'not-a-url' }),
                },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(400);
        });
    });

    describe('DELETE /push/subscription', () => {
        it('push/subscriptionエンドポイント(購読解除)がルーティングされること', async () => {
            const request = new Request(
                'http://localhost:8787/push/subscription',
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpoint: 'https://push.example.com/subscription/abc',
                    }),
                },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
        });
    });

    describe('POST /push/request', () => {
        it('push/requestエンドポイント(発火予約登録)がルーティングされること', async () => {
            const request = new Request('http://localhost:8787/push/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriptionId: 'sub-1',
                    raceId: 'jra202601010101',
                    fireAtMs: 1_700_000_000_000,
                    title: '皐月賞（GⅠ）',
                    body: '中山 11R ・ 発走 5分前',
                }),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
        });

        it('raceIdの形式が不正な場合は400を返すこと', async () => {
            const request = new Request('http://localhost:8787/push/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriptionId: 'sub-1',
                    raceId: 'not-a-valid-race-id',
                    fireAtMs: 1_700_000_000_000,
                    title: '皐月賞（GⅠ）',
                    body: '中山 11R ・ 発走 5分前',
                }),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(400);
        });
    });

    describe('DELETE /push/request', () => {
        it('push/requestエンドポイント(発火予約取消)がルーティングされること', async () => {
            const request = new Request('http://localhost:8787/push/request', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscriptionId: 'sub-1',
                    raceId: 'jra202601010101',
                }),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
        });
    });

    describe('POST /push/dispatch', () => {
        it('push/dispatchエンドポイントがルーティングされること（トークン未設定のため401）', async () => {
            const request = new Request('http://localhost:8787/push/dispatch', {
                method: 'POST',
                headers: { 'X-Push-Dispatch-Token': 'any-token' },
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(401);
        });
    });

    describe('POST /push/test', () => {
        it('push/testエンドポイントがルーティングされること（購読なしのためok:false）', async () => {
            const request = new Request('http://localhost:8787/push/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId: 'sub-not-exist' }),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            const body = (await response.json()) as { ok: boolean };
            expect(body.ok).toBe(false);
        });
    });

    describe('Cache-Control ヘッダー', () => {
        it('GET /place が 200 を返す場合に Cache-Control(PERF-036: 5分/30分) が設定されること', async () => {
            const request = new Request(
                'http://localhost:8787/place?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=JRA',
                { method: 'GET' },
            );

            const response = await router.fetch(request);
            if (response.ok) {
                expect(response.headers.get('Cache-Control')).toBe(
                    'public, max-age=300, s-maxage=1800',
                );
            }
        });

        // KPLAYER-07回帰: /race はレスポンスにisWatched（priority由来、ユーザー
        // 操作で随時変わる全ユーザー共有の値）を含むため、/playerと同様に
        // no-storeでキャッシュを完全に無効化することを確認する。以前の60秒/
        // 300秒設定では、注目選手トグル直後のtimelineProvider/
        // favoriteRacesRawProviderの再取得が古いキャッシュを再利用してしまう
        // レース条件が残っていた（実機で再現）。
        it('GET /race が 200 を返す場合に Cache-Control: no-store が設定されること', async () => {
            const request = new Request(
                'http://localhost:8787/race?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=JRA',
                { method: 'GET' },
            );

            const response = await router.fetch(request);
            if (response.ok) {
                expect(response.headers.get('Cache-Control')).toBe('no-store');
            }
        });

        // PERF-033: `router.use('/race', mw)` の完全一致登録では効かなかった
        // `/race/docs` `/place/docs` のようなサブパスにも、ワイルドカード登録
        // （`/race/*` 等）への変更でキャッシュヘッダーが伝播することを確認する。
        it('GET /race/docs にも Cache-Control: no-store が設定されること(サブパスへの伝播)', async () => {
            const request = new Request('http://localhost:8787/race/docs', {
                method: 'GET',
            });

            const response = await router.fetch(request);
            expect(response.status).toBe(200);
            expect(response.headers.get('Cache-Control')).toBe('no-store');
        });

        it('GET /place/docs にも Cache-Control(PERF-036: 5分/30分) が設定されること(サブパスへの伝播)', async () => {
            const request = new Request('http://localhost:8787/place/docs', {
                method: 'GET',
            });

            const response = await router.fetch(request);
            expect(response.status).toBe(200);
            expect(response.headers.get('Cache-Control')).toBe(
                'public, max-age=300, s-maxage=1800',
            );
        });

        // KPLAYER-07回帰: /player はpriority（注目選手フラグ、ユーザー操作で
        // 随時変わる全ユーザー共有の値）を含むため、`no-store`でキャッシュを
        // 完全に無効化することを確認する。当初は60秒/300秒に短縮する対応を
        // したが、「検索→即タップ」という通常の操作フローではタップ直後の
        // 再取得が60秒以内に収まり、トグル前のキャッシュを再利用してしまう
        // レース条件が残っていた（実機で再現）ため、キャッシュ自体を無効化した。
        it('GET /player が 200 を返す場合に Cache-Control: no-store が設定されること', async () => {
            const request = new Request(
                'http://localhost:8787/player?raceTypeList=jra',
                { method: 'GET' },
            );

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            expect(response.headers.get('Cache-Control')).toBe('no-store');
        });

        // CFCACHE-09: /health はヘッダー無しの場合、中間キャッシュの挙動が
        // クライアント/プロキシ実装依存になる（RFC 7234 §4.2.2 の発見的
        // キャッシュ）。監視対象として常に最新状態を返す必要があるため
        // no-storeを明示する。
        it('GET /health が 200 を返す場合に Cache-Control: no-store が設定されること', async () => {
            const request = new Request('http://localhost:8787/health', {
                method: 'GET',
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            expect(response.headers.get('Cache-Control')).toBe('no-store');
        });

        // PERF-034: `/calendar/flag` のGET(一覧取得)はCACHEABLE_PATHSに個別列挙
        // されていないが、PERF-033の `/calendar/*` ワイルドカード化により既に
        // Cache-Controlが適用されている。この挙動を固定する回帰テスト。
        it('GET /calendar/flag に Cache-Control が設定されること', async () => {
            const request = new Request('http://localhost:8787/calendar/flag', {
                method: 'GET',
                headers: authHeaders(),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            expect(response.headers.get('Cache-Control')).toBe(
                'public, max-age=60, s-maxage=300',
            );
        });

        it('POST /calendar/flag には Cache-Control が設定されないこと', async () => {
            const request = new Request('http://localhost:8787/calendar/flag', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ raceId: 'jra202601010101' }),
            });

            const response = await router.fetch(request, mockHonoEnv);
            expect(response.status).toBe(200);
            expect(response.headers.get('Cache-Control')).toBeNull();
        });
    });
});

/**
 * サービス間認証: ルート分類の回帰防止テスト（SECAUTH-08）
 *
 * `router.routes`（Hono が実際に登録した具体的なハンドラルート。`ALL` や `/*`
 * ワイルドカードのミドルウェア登録は除外）を、`SERVICE_AUTH_EXEMPT_ROUTES` に
 * 明示された「免除リスト」と、それ以外の「保護対象」に突き合わせる。
 *
 * 新しいルートを `router.ts` に追加したとき、`EXPECTED_EXEMPT_ROUTE_KEYS` /
 * `EXPECTED_PROTECTED_ROUTE_KEYS` のどちらにも含まれていなければ
 * `ルート一覧が想定どおりに分類されていること` が失敗する。開発者は追加した
 * ルートを免除リストに載せるか保護対象のままにするかを明示的に選び、
 * このテストの期待値リストを更新しなければならない（分類忘れの検知）。
 */
describe('サービス間認証: ルート分類の回帰防止（SECAUTH-08）', () => {
    let regressionMockHonoEnv: ReturnType<typeof buildMockHonoEnv>;

    beforeEach(() => {
        const db = createInMemoryD1Database();
        regressionMockHonoEnv = buildMockHonoEnv(db);
        setupGlobalMocks(db);
        process.env.CORS_ALLOWED_ORIGINS = '*';
    });

    /** `router.routes` からミドルウェア登録（method: 'ALL' または path が `/*` 系）を除いた実ハンドラルート */
    const concreteRoutes = router.routes.filter(
        (route) => route.method !== 'ALL' && !route.path.endsWith('/*'),
    );

    const routeKey = (route: { method: string; path: string }): string =>
        `${route.method} ${route.path}`;

    const EXPECTED_EXEMPT_ROUTE_KEYS = [
        'GET /health',
        'GET /ui/announcement',
        'GET /ui/race-detail',
        'GET /openapi.json',
        'GET /docs',
        'GET /calendar',
        'GET /place',
        'GET /place/docs',
        'GET /race',
        'GET /race/docs',
        'GET /race/calendar-event',
        'GET /race/players',
        'GET /player',
        'POST /player',
        'POST /push/subscription',
        'DELETE /push/subscription',
        'POST /push/request',
        'DELETE /push/request',
        'POST /push/test',
        'POST /push/dispatch',
    ];

    const EXPECTED_PROTECTED_ROUTE_KEYS = [
        'GET /calendar/flag',
        'POST /calendar/flag',
        'DELETE /calendar/flag',
        'POST /place',
        'POST /race',
        'GET /debug/database',
        'POST /internal/batch-lock/acquire',
        'POST /internal/batch-lock/release',
        'GET /internal/feature-flags',
        'POST /internal/feature-flags',
        'GET /internal/ui-layout',
        'POST /internal/ui-layout',
        'POST /internal/ui-layout/preview',
        'POST /internal/backfill/place',
        'POST /internal/backfill/race',
    ];

    it('ルート一覧が想定どおりに分類されていること（免除リスト+保護対象=登録済み全ルート）', () => {
        const actualKeys = new Set(concreteRoutes.map(routeKey));
        const expectedKeys = new Set([
            ...EXPECTED_EXEMPT_ROUTE_KEYS,
            ...EXPECTED_PROTECTED_ROUTE_KEYS,
        ]);

        expect(actualKeys).toEqual(expectedKeys);
    });

    it.each(EXPECTED_EXEMPT_ROUTE_KEYS.map((key) => [key] as const))(
        '免除ルート %s は SERVICE_AUTH_EXEMPT_ROUTES 上で免除と判定されること',
        (key) => {
            const [method, path] = key.split(' ');
            expect(isExempt(method, path, SERVICE_AUTH_EXEMPT_ROUTES)).toBe(
                true,
            );
        },
    );

    it.each(EXPECTED_PROTECTED_ROUTE_KEYS.map((key) => [key] as const))(
        '保護対象ルート %s は SERVICE_AUTH_EXEMPT_ROUTES 上で非免除と判定されること',
        (key) => {
            const [method, path] = key.split(' ');
            expect(isExempt(method, path, SERVICE_AUTH_EXEMPT_ROUTES)).toBe(
                false,
            );
        },
    );

    it('主要な保護ルート（POST /race）はトークン無しで401になること', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8787/race', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }),
            regressionMockHonoEnv,
        );

        expect(response.status).toBe(401);
    });

    it('主要な公開ルート（GET /race）はトークン無しでも200系になること', async () => {
        const searchParams = new URLSearchParams({
            startDate: '2026-01-01',
            finishDate: '2026-01-31',
            raceTypeList: 'jra',
        });
        const response = await router.fetch(
            new Request(
                `http://localhost:8787/race?${searchParams.toString()}`,
                {
                    method: 'GET',
                },
            ),
            regressionMockHonoEnv,
        );

        expect(response.status).toBeLessThan(300);
    });

    it('保護ルート（POST /internal/backfill/place）はトークン無しで401になること', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8787/internal/backfill/place', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: '2026-01-01',
                    finishDate: '2026-01-31',
                    raceTypeList: ['keirin'],
                }),
            }),
            regressionMockHonoEnv,
        );

        expect(response.status).toBe(401);
    });

    it('保護ルート（POST /internal/backfill/place）はサービス間認証トークン付きでscraping Workerへ委譲されること', async () => {
        const originalFetch = globalThis.fetch;
        const originalScrapingApiUrl = process.env.SCRAPING_API_URL;
        process.env.SCRAPING_API_URL = 'https://scraping.example.com';
        globalThis.fetch = mock(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        successCount: 0,
                        failureCount: 0,
                        failures: [],
                        notCachedKeys: [],
                    }),
                    { status: 200 },
                ),
            ),
        ) as unknown as typeof fetch;

        try {
            const response = await router.fetch(
                new Request('http://localhost:8787/internal/backfill/place', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
                    },
                    body: JSON.stringify({
                        startDate: '2026-01-01',
                        finishDate: '2026-01-31',
                        raceTypeList: ['keirin'],
                    }),
                }),
                regressionMockHonoEnv,
            );

            expect(response.status).toBe(200);
        } finally {
            globalThis.fetch = originalFetch;
            if (originalScrapingApiUrl === undefined) {
                delete process.env.SCRAPING_API_URL;
            } else {
                process.env.SCRAPING_API_URL = originalScrapingApiUrl;
            }
        }
    });

    it('保護ルート（POST /internal/backfill/race）はサービス間認証トークン付きで対象0件なら200になること', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8787/internal/backfill/race', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
                },
                body: JSON.stringify({
                    startDate: '2026-01-01',
                    finishDate: '2026-01-31',
                    raceTypeList: ['keirin'],
                }),
            }),
            regressionMockHonoEnv,
        );

        expect(response.status).toBe(200);
    });
});
