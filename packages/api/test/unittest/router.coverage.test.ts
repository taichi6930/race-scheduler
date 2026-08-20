/**
 * Router 追加カバレッジテスト（API）
 *
 * router.test.ts で未到達だったハンドラ本体（docs エンドポイント・debug の D1 分岐と
 * catch 分岐）を網羅する。
 *
 * ## デシジョンテーブル（router ハンドラ）
 *
 * | #    | Endpoint          | 事前条件                                   | 期待結果                         |
 * |------|-------------------|--------------------------------------------|----------------------------------|
 * | T-01 | GET /place/docs   | -                                          | 200・endpoint='GET /place'       |
 * | T-02 | GET /race/docs    | -                                          | 200・endpoint='GET /race'        |
 * | T-04 | GET /debug/database | race/race_condition にデータあり          | 200・success=true・count 反映    |
 * | T-05 | GET /debug/database | race/race_condition が空                  | 200・success=true・count=0       |
 * | T-06 | GET /debug/database | select が throw                            | 500・handleApiError で返る       |
 * | T-14 | GET /debug/database | USE_IN_MEMORY_DB=false（D1本番相当）        | 404・success=false               |
 * | T-15 | GET /debug/database | DebugController の DI 解決自体が throw       | 500・router側catchのhandleApiErrorで返る |
 * | T-08 | GET /place        | controller.get が throw                     | 500・handleApiError で返る       |
 * | T-09 | POST /place       | controller.upsert が throw                  | 500・handleApiError で返る       |
 * | T-10 | GET /calendar/flag  | controller.flagList が throw               | 500・handleApiError で返る       |
 * | T-11 | POST /calendar/flag | controller.flagAdd が throw                | 500・handleApiError で返る       |
 * | T-12 | DELETE /calendar/flag | controller.flagRemove が throw           | 500・handleApiError で返る       |
 * | T-13 | GET /health（連続2回） | 2回目で CORS_ALLOWED_ORIGINS を変更        | 2回目のリクエストにも変更後の Origin が反映される（CORS ミドルウェアキャッシュの再構築） |
 * | T-16 | GET /openapi.json | -                                          | 200・OpenAPI仕様（openapi:'3.0.3'、paths非空） |
 * | T-17 | GET /docs         | -                                          | 200・Scalar UIのHTML                |
 * | T-18 | GET /docs         | -                                          | CSPがCDN（cdn.jsdelivr.net）からの読み込みを許可する（実機で画面が空白になった不具合の回帰） |
 * | T-19 | GET /openapi.json | -                                          | CSPは他エンドポイント同様 default-src 'none' のまま |
 */
import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DI_TOKENS, SERVICE_AUTH_HEADER } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { container } from 'tsyringe';

import { AuthController } from '../../src/controller/authController';
import { CalendarController } from '../../src/controller/calendarController';
import { DebugController } from '../../src/controller/debugController';
import { PlaceController } from '../../src/controller/placeController';
import * as schema from '../../src/db/schema';
import type { IDrizzleGateway } from '../../src/gateway/interface/IDrizzleGateway';
import { router } from '../../src/router';
import { createInMemoryD1Database } from '../common/inMemoryD1';
import {
    buildMockHonoEnv as buildMockEnv,
    MOCK_SERVICE_AUTH_TOKEN,
} from '../common/mockHonoEnv';
import { insertTestSession } from '../common/sessionAuth';
import { setupGlobalMocks } from '../common/setupGlobalMocks';

let mockEnv: ReturnType<typeof buildMockEnv>;

/** 保護対象ルート向けに、サービス間認証ヘッダーを付与したヘッダーを組み立てる */
const authHeaders = (
    extra?: Record<string, string>,
): Record<string, string> => ({
    ...extra,
    [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
});

/**
 * ensureDIInitialized を一度通し、DI 初期化済みフラグを true にする（以降は
 * container の登録を上書きしても再初期化で消されない）。
 */
const warmUpDI = async (): Promise<void> => {
    await router.fetch(
        new Request('http://localhost/debug/database', {
            headers: authHeaders(),
        }),
        mockEnv,
    );
};

/**
 * IDrizzleGateway を差し替える。ensureDIInitialized が既に初期化済みであることを前提とする。
 * @param gateway - 登録する Drizzle ゲートウェイ
 */
const registerGateway = (gateway: IDrizzleGateway): void => {
    container.register(DI_TOKENS.DrizzleGateway, { useValue: gateway });
};

/** select チェーンが必ず reject する DrizzleD1Database の最小フェイク（T-06用） */
const buildFailingSelectDb = (
    reason: unknown,
): DrizzleD1Database<typeof schema> => {
    const chain: Record<string, unknown> = {
        from: () => chain,
        then: (
            _resolve: (value: never) => void,
            reject: (reason: unknown) => void,
        ) => Promise.reject(reason).catch(reject),
    };
    const failing = { select: () => chain };
    return failing as unknown as DrizzleD1Database<typeof schema>;
};

/**
 * router 内の CrudController と同型の最小インターフェース。
 * get/upsert のみを差し替えて catch 分岐を検証する。
 */
interface CrudControllerLike {
    get: (searchParams: URLSearchParams) => Promise<Response>;
    upsert: (request: Request) => Promise<Response>;
}

/**
 * PlaceController を差し替える（get/upsert が例外を投げるダブル）。
 * @param controller - 登録するコントローラダブル
 */
const registerBrokenPlaceController = (
    controller: CrudControllerLike,
): void => {
    container.register<CrudControllerLike>(PlaceController, {
        useValue: controller,
    });
};

/**
 * router 内の /calendar/flag ハンドラが呼ぶ CalendarController のメソッドと同型の
 * 最小インターフェース。flagList/flagAdd のみを差し替えて catch 分岐を検証する。
 */
interface CalendarFlagControllerLike {
    flagList: () => Promise<Response>;
    flagAdd: (request: Request) => Promise<Response>;
    flagRemove: (request: Request) => Promise<Response>;
}

/**
 * router 内の PATCH /auth/credential/:id ハンドラが呼ぶ AuthController の
 * メソッドと同型の最小インターフェース。renameCredential のみを差し替えて
 * catch 分岐を検証する。
 */
interface RenameCredentialControllerLike {
    renameCredential: (
        request: Request,
        credentialId: string,
    ) => Promise<Response>;
}

/**
 * AuthController を差し替える（renameCredential が例外を投げるダブル）。
 * @param controller - 登録するコントローラダブル
 */
const registerBrokenAuthController = (
    controller: RenameCredentialControllerLike,
): void => {
    container.register<RenameCredentialControllerLike>(AuthController, {
        useValue: controller,
    });
};

/**
 * CalendarController を差し替える（flagList/flagAdd/flagRemove が例外を投げるダブル）。
 * @param controller - 登録するコントローラダブル
 */
const registerBrokenCalendarController = (
    controller: CalendarFlagControllerLike,
): void => {
    container.register<CalendarFlagControllerLike>(CalendarController, {
        useValue: controller,
    });
};

describe('API Router (追加カバレッジ)', () => {
    beforeEach(() => {
        const db = createInMemoryD1Database();
        mockEnv = buildMockEnv(db);
        setupGlobalMocks(db);
        process.env.CORS_ALLOWED_ORIGINS = '*';
    });

    afterEach(() => {
        container.clearInstances();
    });

    describe('GET /place/docs', () => {
        it('placeDocs_リクエスト_200とドキュメントJSONを返すこと', async () => {
            // Arrange
            const request = new Request('http://localhost/place/docs');

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(200);
            const json = await response.json<{ endpoint: string }>();
            expect(json.endpoint).toBe('GET /place');
        });
    });

    describe('GET /race/docs', () => {
        it('raceDocs_リクエスト_200とドキュメントJSONを返すこと', async () => {
            // Arrange
            const request = new Request('http://localhost/race/docs');

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(200);
            const json = await response.json<{ endpoint: string }>();
            expect(json.endpoint).toBe('GET /race');
        });
    });

    describe('GET /openapi.json', () => {
        it('openApiJson_リクエスト_200とOpenAPI仕様を返すこと', async () => {
            // Arrange
            const request = new Request('http://localhost/openapi.json');

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(200);
            const json = await response.json<{
                openapi: string;
                paths: Record<string, unknown>;
            }>();
            expect(json.openapi).toBe('3.0.3');
            expect(Object.keys(json.paths).length).toBeGreaterThan(0);
        });

        it("openApiJson_リクエスト_CSPは他エンドポイント同様default-src 'none'のままであること", async () => {
            // Arrange
            const request = new Request('http://localhost/openapi.json');

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.headers.get('Content-Security-Policy')).toBe(
                "default-src 'none'",
            );
        });
    });

    describe('GET /docs', () => {
        it('docs_リクエスト_200とHTMLを返すこと', async () => {
            // Arrange
            const request = new Request('http://localhost/docs');

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(200);
            const text = await response.text();
            expect(text).toContain('<!doctype html>');
        });

        it('docs_リクエスト_CSPがCDNからの読み込みを許可すること（画面が空白になる不具合の回帰）', async () => {
            // Arrange
            const request = new Request('http://localhost/docs');

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            const csp = response.headers.get('Content-Security-Policy');
            expect(csp).toContain('https://cdn.jsdelivr.net');
            expect(csp).not.toBe("default-src 'none'");
        });
    });

    describe('GET /debug/database', () => {
        it('debugDatabase_race/race_conditionにデータあり_200でカウントを反映すること', async () => {
            // Arrange
            await warmUpDI();
            const db = drizzle(createInMemoryD1Database(), { schema });
            await db.insert(schema.place).values({
                placeId: 'jra2026042605',
                raceType: 'jra',
                dateTime: '2026-04-26T00:00:00+09:00',
                locationCode: '05',
            });
            await db.insert(schema.race).values([
                {
                    raceId: 'jra202604260501',
                    placeId: 'jra2026042605',
                    raceType: 'jra',
                    dateTime: '2026-04-26T10:00:00+09:00',
                    locationCode: '05',
                    raceNumber: 1,
                },
                {
                    raceId: 'jra202604260502',
                    placeId: 'jra2026042605',
                    raceType: 'jra',
                    dateTime: '2026-04-26T11:00:00+09:00',
                    locationCode: '05',
                    raceNumber: 2,
                },
            ]);
            await db.insert(schema.raceCondition).values({
                raceId: 'jra202604260501',
                distance: 2000,
                surfaceType: '芝',
            });
            registerGateway({ db });
            const request = new Request('http://localhost/debug/database', {
                headers: authHeaders(),
            });

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(200);
            const json = await response.json<{
                success: boolean;
                raceCount: number;
                raceConditionCount: number;
            }>();
            expect(json.success).toBe(true);
            expect(json.raceCount).toBe(2);
            expect(json.raceConditionCount).toBe(1);
        });

        it('debugDatabase_race/race_conditionが空_200でcount0を返すこと', async () => {
            // Arrange
            await warmUpDI();
            const db = drizzle(createInMemoryD1Database(), { schema });
            registerGateway({ db });
            const request = new Request('http://localhost/debug/database', {
                headers: authHeaders(),
            });

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(200);
            const json = await response.json<{
                success: boolean;
                raceCount: number;
                raceConditionCount: number;
            }>();
            expect(json.success).toBe(true);
            expect(json.raceCount).toBe(0);
            expect(json.raceConditionCount).toBe(0);
        });

        it('debugDatabase_selectがthrow_500でerrorを返すこと', async () => {
            // Arrange
            await warmUpDI();
            const gateway: IDrizzleGateway = {
                db: buildFailingSelectDb(new Error('boom')),
            };
            registerGateway(gateway);
            const request = new Request('http://localhost/debug/database', {
                headers: authHeaders(),
            });

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(500);
            const json = await response.json<{
                status: number;
                message: string;
            }>();
            expect(json.status).toBe(500);
            // サービス間認証済み（authHeaders()）の呼び出しのため、SEC-017の例外として
            // エラー詳細を含む（resolveInternalErrorMessage）
            expect(json.message).toBe('Error: boom');
        });

        it('debugDatabase_DebugControllerのDI解決自体がthrow_router側catchで500を返すこと', async () => {
            // Arrange
            // DebugController.database内部の try/catch（T-06）とは異なり、
            // registerDebugRoutes（router.ts）のtry/catchが直接ラップしている
            // `container.resolve(DebugController)` 自体の失敗を検証する。
            // useFactoryは呼び出しごとに評価されキャッシュされないため、
            // 解決時に必ずthrowするダブルとして差し替えられる。
            await warmUpDI();
            container.register(DebugController, {
                useFactory: () => {
                    throw new Error('DI resolve boom');
                },
            });
            const request = new Request('http://localhost/debug/database', {
                headers: authHeaders(),
            });

            try {
                // Act
                const response = await router.fetch(request, mockEnv);

                // Assert
                expect(response.status).toBe(500);
                const json = await response.json<{
                    status: number;
                    message: string;
                }>();
                expect(json.status).toBe(500);
                // サービス間認証済み（authHeaders()）のためエラー詳細を含む
                expect(json.message).toBe('Error: DI resolve boom');
            } finally {
                // useFactoryによる差し替えは container.clearInstances()（afterEach）
                // では戻らない（登録自体は残り続ける）ため、他テストへ影響しないよう
                // 元のクラス登録に明示的に戻す。
                container.register(DebugController, {
                    useClass: DebugController,
                });
            }
        });
    });

    describe('GET /place (controller 例外)', () => {
        it('placeGet_controllerがthrow_500でhandleApiErrorが返ること', async () => {
            // Arrange
            await warmUpDI();
            const brokenController: CrudControllerLike = {
                get: (): Promise<Response> => {
                    throw new Error('controller boom');
                },
                upsert: (): Promise<Response> =>
                    Promise.resolve(new Response()),
            };
            registerBrokenPlaceController(brokenController);
            const request = new Request(
                'http://localhost/place?startDate=2026-01-01&finishDate=2026-12-31&raceTypeList=jra',
            );

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(500);
            const json = await response.json<{
                status: number;
                message: string;
            }>();
            expect(json.status).toBe(500);
            expect(json.message).toBe('Internal Server Error');
        });

        it('placePost_controllerがthrow_500でhandleApiErrorが返ること', async () => {
            // Arrange
            await warmUpDI();
            const brokenController: CrudControllerLike = {
                get: (): Promise<Response> => Promise.resolve(new Response()),
                upsert: (): Promise<Response> => {
                    throw new Error('upsert boom');
                },
            };
            registerBrokenPlaceController(brokenController);
            const request = new Request('http://localhost/place', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify([]),
            });

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(500);
            const json = await response.json<{
                status: number;
                message: string;
            }>();
            expect(json.status).toBe(500);
            // サービス間認証済み（authHeaders()）のためエラー詳細を含む
            expect(json.message).toBe('Error: upsert boom');
        });
    });

    describe('GET /calendar/flag (controller 例外)', () => {
        it('calendarFlagList_controllerがthrow_500でhandleApiErrorが返ること', async () => {
            // Arrange
            await warmUpDI();
            const brokenController: CalendarFlagControllerLike = {
                flagList: (): Promise<Response> => {
                    throw new Error('flagList boom');
                },
                flagAdd: (): Promise<Response> =>
                    Promise.resolve(new Response()),
                flagRemove: (): Promise<Response> =>
                    Promise.resolve(new Response()),
            };
            registerBrokenCalendarController(brokenController);
            const request = new Request('http://localhost/calendar/flag', {
                headers: authHeaders(),
            });

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(500);
            const json = await response.json<{
                status: number;
                message: string;
            }>();
            expect(json.status).toBe(500);
            // サービス間認証済み（authHeaders()）のためエラー詳細を含む
            expect(json.message).toBe('Error: flagList boom');
        });
    });

    describe('POST /calendar/flag (controller 例外)', () => {
        it('calendarFlagAdd_controllerがthrow_500でhandleApiErrorが返ること', async () => {
            // Arrange
            await warmUpDI();
            const brokenController: CalendarFlagControllerLike = {
                flagList: (): Promise<Response> =>
                    Promise.resolve(new Response()),
                flagAdd: (): Promise<Response> => {
                    throw new Error('flagAdd boom');
                },
                flagRemove: (): Promise<Response> =>
                    Promise.resolve(new Response()),
            };
            registerBrokenCalendarController(brokenController);
            const request = new Request('http://localhost/calendar/flag', {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ raceId: 'jra202601010101' }),
            });

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(500);
            const json = await response.json<{
                status: number;
                message: string;
            }>();
            expect(json.status).toBe(500);
            // サービス間認証済み（authHeaders()）のためエラー詳細を含む
            expect(json.message).toBe('Error: flagAdd boom');
        });
    });

    describe('DELETE /calendar/flag (controller 例外)', () => {
        it('calendarFlagRemove_controllerがthrow_500でhandleApiErrorが返ること', async () => {
            // Arrange
            await warmUpDI();
            const brokenController: CalendarFlagControllerLike = {
                flagList: (): Promise<Response> =>
                    Promise.resolve(new Response()),
                flagAdd: (): Promise<Response> =>
                    Promise.resolve(new Response()),
                flagRemove: (): Promise<Response> => {
                    throw new Error('flagRemove boom');
                },
            };
            registerBrokenCalendarController(brokenController);
            const request = new Request('http://localhost/calendar/flag', {
                method: 'DELETE',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ raceId: 'jra202601010101' }),
            });

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(500);
            const json = await response.json<{
                status: number;
                message: string;
            }>();
            expect(json.status).toBe(500);
            // サービス間認証済み（authHeaders()）のためエラー詳細を含む
            expect(json.message).toBe('Error: flagRemove boom');
        });
    });

    describe('デバッグエンドポイントの本番(D1)ガード', () => {
        const originalUseInMemoryDb = process.env.USE_IN_MEMORY_DB;

        beforeEach(() => {
            process.env.USE_IN_MEMORY_DB = 'false';
        });

        afterEach(() => {
            if (originalUseInMemoryDb === undefined) {
                delete process.env.USE_IN_MEMORY_DB;
            } else {
                process.env.USE_IN_MEMORY_DB = originalUseInMemoryDb;
            }
        });

        it('[T-14] debugDatabase_D1本番相当のenv_404でsuccess falseを返すこと', async () => {
            // Arrange
            await warmUpDI();
            const prodEnv = { ...mockEnv, USE_IN_MEMORY_DB: 'false' };
            const request = new Request('http://localhost/debug/database', {
                headers: authHeaders(),
            });

            // Act
            const response = await router.fetch(request, prodEnv);

            // Assert
            expect(response.status).toBe(404);
            const json = await response.json<{ success: boolean }>();
            expect(json.success).toBe(false);
        });
    });

    describe('CORS ミドルウェアのキャッシュ再構築', () => {
        it('corsCache_連続リクエストでCORS_ALLOWED_ORIGINSが変わる_2回目も変更後のOriginを反映すること', async () => {
            // Arrange
            const firstOrigin = 'http://cors-cache-test-one.example';
            const secondOrigin = 'http://cors-cache-test-two.example';

            // Act
            const firstResponse = await router.fetch(
                new Request('http://localhost/health', {
                    headers: { Origin: firstOrigin },
                }),
                { ...mockEnv, CORS_ALLOWED_ORIGINS: firstOrigin },
            );
            const secondResponse = await router.fetch(
                new Request('http://localhost/health', {
                    headers: { Origin: secondOrigin },
                }),
                { ...mockEnv, CORS_ALLOWED_ORIGINS: secondOrigin },
            );

            // Assert
            expect(
                firstResponse.headers.get('Access-Control-Allow-Origin'),
            ).toBe(firstOrigin);
            expect(
                secondResponse.headers.get('Access-Control-Allow-Origin'),
            ).toBe(secondOrigin);
        });
    });

    describe('PATCH /auth/credential/:id (controller 例外)', () => {
        it('renameCredential_controllerがthrow_500でhandleApiErrorが返ること', async () => {
            // Arrange
            await warmUpDI();
            const brokenController: RenameCredentialControllerLike = {
                renameCredential: (): Promise<Response> => {
                    throw new Error('renameCredential boom');
                },
            };
            registerBrokenAuthController(brokenController);
            const db = drizzle(mockEnv.DB, { schema });
            const sessionHeaders = await insertTestSession(db);
            const request = new Request(
                'http://localhost/auth/credential/test-user-1-credential',
                {
                    method: 'PATCH',
                    headers: {
                        ...sessionHeaders,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ deviceLabel: '新ラベル' }),
                },
            );

            // Act
            const response = await router.fetch(request, mockEnv);

            // Assert
            expect(response.status).toBe(500);
        });
    });
});
