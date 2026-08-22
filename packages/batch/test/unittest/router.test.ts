/**
 * Batch Router テスト
 *
 * @spec SPEC-API-001
 *
 * HTTP ルーティング定義（GET /health, POST /batch/trigger）の振る舞いを検証します
 * （CICD-73/CONC-03: batch-all/race/place/calendarの4起動経路を単一エンドポイントへ統合）。
 * POST /batch/trigger は各バリデーション分岐・ロック競合(409)・binding未設定(500)・
 * 成功系(202)をカバーします。acquireBatchLock/workflowBinding.createが例外を投げる
 * catch（500）系は router.error.test.ts に分離しています。
 *
 * ## デシジョンテーブル（router）
 *
 * | #    | メソッド/条件                                          | 期待結果                                              |
 * |------|----------------------------------------------------------|----------------------------------------------------------|
 * | T-01 | GET /health                                               | 200 `{ status: 'ok', package: 'batch' }`（QAPI-06）      |
 * | T-02 | POST 不正な JSON body                                     | 400 'Bad Request' / 'Invalid JSON body'                 |
 * | T-03 | POST raceTypes に不正な値を含む                           | 400 'Invalid raceType'                                  |
 * | T-04 | POST targets に不正な列挙値を含む                         | 400 'Invalid JSON body'（zodスキーマレベルで失敗）      |
 * | T-05 | POST startDate のみ指定（finishDate省略）                 | 400 'startDate and finishDate must be provided together'|
 * | T-05b| POST finishDate のみ指定（startDate省略）                 | 400 'startDate and finishDate must be provided together'|
 * | T-06 | POST startDateがYYYY-MM-DD形式でない                       | 400 'startDate and finishDate must be YYYY-MM-DD'       |
 * | T-06b| POST finishDateがYYYY-MM-DD形式でない                      | 400 'startDate and finishDate must be YYYY-MM-DD'       |
 * | T-07 | POST 日付レンジが対象の組み合わせの上限を超過              | 400 'Range too large'                                   |
 * | T-08 | POST BATCH_ALL_WORKFLOW bindingが未設定                   | 500 'BATCH_ALL_WORKFLOW binding is not configured'      |
 * | T-09 | POST ロック取得できない（他インスタンス実行中）             | 409 'Conflict' / '他のbatch実行が進行中です'             |
 * | T-10 | POST 全フィールド省略（cron相当）で成功                    | 202 { success:true, instanceId }                        |
 * | T-11 | POST raceTypes/targets/日付を指定して成功                 | 202・Workflow.createにそのままparamsとして渡される       |
 * | T-12 | POST bodyがJSONとして妥当だがオブジェクトでない（null）    | 400 'Bad Request' / 'Invalid JSON body'                 |
 * | T-13 | GET /health（連続2回、CORS_ALLOWED_ORIGINSを変更）        | 2回目のリクエストにも変更後のOriginが反映される（PERF-048）|
 * | T-14 | POST startDate/finishDateのみ指定（raceTypes/targets省略） | 202・raceTypes/targetsの `?? 既定値` フォールバックが使われる |
 * | T-15 | GET /health（CORS_ALLOWED_ORIGINS未設定）                  | 200・`process.env.CORS_ALLOWED_ORIGINS ?? ''` のフォールバックが使われる |
 * | T-16 | GET /health（許可リストに無いOrigin）                       | Access-Control-Allow-Originヘッダが付与されない（拒否分岐） |
 * | T-17 | GET /health（CORS_ALLOWED_ORIGINS='*'）                    | Access-Control-Allow-Origin: '*'（全許可分岐、テスト用途） |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { EnvStore, isExempt, SERVICE_AUTH_HEADER } from '@race-schedule/core';

import { router, SERVICE_AUTH_EXEMPT_ROUTES } from '../../src/router';

const MOCK_SERVICE_AUTH_TOKEN = 'mock-service-auth-token';

const TEST_ENV = {
    SCRAPING_API_URL: 'http://scraping.test',
    MAIN_API_URL: 'http://main.test',
};

/** テスト用の最小限の Workflow バインディング型（`@cloudflare/workers-types` の Workflow を模す）。 */
interface FakeWorkflowInstance {
    id: string;
}

interface FakeWorkflowBinding {
    create: (options: {
        id: string;
        params: unknown;
    }) => Promise<FakeWorkflowInstance>;
}

const createSucceedingWorkflowBinding = (): FakeWorkflowBinding => ({
    create: async ({ id }) => ({ id }),
});

interface LockFetchOptions {
    acquired: boolean;
}

/**
 * acquireBatchLock/releaseBatchLock（`client/batchLock.ts`）が発行する fetch を
 * URLパスで判別してモックする。router.ts のハンドラ自身はこの2エンドポイント以外に
 * fetch を発行しないため、これだけで T-08〜T-11 のロック絡みの分岐を再現できる。
 */
const installLockFetchSpy = (
    options: LockFetchOptions = { acquired: true },
): ReturnType<typeof spyOn> => {
    const spy = spyOn(globalThis, 'fetch');
    spy.mockImplementation((async (input: URL | string) => {
        const url = String(input);
        if (url.includes('/internal/batch-lock/acquire')) {
            if (!options.acquired) {
                return {
                    ok: false,
                    status: 409,
                    text: async () => 'conflict',
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ acquired: true }),
            };
        }
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    }) as unknown as typeof fetch);
    return spy;
};

const postTrigger = async (
    body: unknown,
    env: Record<string, unknown> = TEST_ENV,
): Promise<Response> =>
    router.request(
        '/batch/trigger',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: typeof body === 'string' ? body : JSON.stringify(body),
        },
        env,
    );

describe('router', () => {
    let fetchSpy: ReturnType<typeof spyOn> | undefined;

    beforeEach(() => {
        process.env.SCRAPING_API_URL = TEST_ENV.SCRAPING_API_URL;
        process.env.MAIN_API_URL = TEST_ENV.MAIN_API_URL;
        process.env.SERVICE_AUTH_TOKEN = MOCK_SERVICE_AUTH_TOKEN;
    });

    afterEach(() => {
        fetchSpy?.mockRestore();
        fetchSpy = undefined;
        // router.request の env 経由で setEnv された状態を他ファイルへ持ち越さない
        EnvStore.reset();
    });

    it('T-01_GET_health_200とJSONを返す', async () => {
        // Act
        const res = await router.request('/health');

        // Assert
        expect(res.status).toBe(200);
        // QAPI-06: 4 Worker横断でJSON形状を揃える
        const body = (await res.json()) as { status: string; package: string };
        expect(body).toEqual({ status: 'ok', package: 'batch' });
    });

    it('T-13_corsCache_連続リクエストでCORS_ALLOWED_ORIGINSが変わる_2回目も変更後のOriginを反映すること', async () => {
        // Arrange
        const originalCorsEnv = process.env.CORS_ALLOWED_ORIGINS;
        const firstOrigin = 'http://cors-cache-test-one.example';
        const secondOrigin = 'http://cors-cache-test-two.example';

        try {
            // Act
            process.env.CORS_ALLOWED_ORIGINS = firstOrigin;
            const firstResponse = await router.fetch(
                new Request('http://localhost/health', {
                    headers: { Origin: firstOrigin },
                }),
            );

            process.env.CORS_ALLOWED_ORIGINS = secondOrigin;
            const secondResponse = await router.fetch(
                new Request('http://localhost/health', {
                    headers: { Origin: secondOrigin },
                }),
            );

            // Assert
            expect(
                firstResponse.headers.get('Access-Control-Allow-Origin'),
            ).toBe(firstOrigin);
            expect(
                secondResponse.headers.get('Access-Control-Allow-Origin'),
            ).toBe(secondOrigin);
        } finally {
            // Cleanup: 他テストへ影響しないようCORS_ALLOWED_ORIGINSを復元する
            process.env.CORS_ALLOWED_ORIGINS = originalCorsEnv;
        }
    });

    it('T-14_startDateとfinishDateのみ指定_raceTypesとtargetsのフォールバック既定値で成功する', async () => {
        // Arrange: raceTypes/targets を省略しつつ startDate/finishDate は指定することで、
        // validateRangeIfDatesProvided 経由で `raceTypes ?? ALL_RACE_TYPES_FOR_BATCH` /
        // `targets ?? ALL_EXEC_TARGETS` のフォールバック分岐（未指定側）を通す。
        // 全raceType×全target中の最小上限（race×keirin等=10日）に収まる短い期間にする。
        fetchSpy = installLockFetchSpy({ acquired: true });

        // Act
        const res = await postTrigger(
            { startDate: '2026-01-01', finishDate: '2026-01-03' },
            {
                ...TEST_ENV,
                BATCH_ALL_WORKFLOW: createSucceedingWorkflowBinding(),
            },
        );

        // Assert
        expect(res.status).toBe(202);
        const json = (await res.json()) as { success: boolean };
        expect(json.success).toBe(true);
    });

    it('T-15_CORSALLOWEDORIGINS未設定でリクエスト_200を返す', async () => {
        // Arrange: process.env.CORS_ALLOWED_ORIGINS を明示的に未設定にし、
        // `process.env.CORS_ALLOWED_ORIGINS ?? ''` のフォールバック分岐を通す。
        const originalCorsEnv = process.env.CORS_ALLOWED_ORIGINS;
        delete process.env.CORS_ALLOWED_ORIGINS;

        try {
            // Act
            const res = await router.request('/health');

            // Assert
            expect(res.status).toBe(200);
        } finally {
            // Cleanup: 他テストへ影響しないよう復元する
            if (originalCorsEnv === undefined) {
                delete process.env.CORS_ALLOWED_ORIGINS;
            } else {
                process.env.CORS_ALLOWED_ORIGINS = originalCorsEnv;
            }
        }
    });

    it('T-16_許可リストに無いOriginでリクエスト_AccessControlAllowOriginヘッダが付与されない', async () => {
        // Arrange: CORS_ALLOWED_ORIGINS を特定オリジンに限定し、それ以外のOriginで
        // リクエストすることで cors コールバックの拒否分岐（`: ''`）を通す。
        const originalCorsEnv = process.env.CORS_ALLOWED_ORIGINS;
        process.env.CORS_ALLOWED_ORIGINS = 'http://allowed.example';

        try {
            // Act
            const res = await router.fetch(
                new Request('http://localhost/health', {
                    headers: { Origin: 'http://not-allowed.example' },
                }),
            );

            // Assert
            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
        } finally {
            // Cleanup: 他テストへ影響しないよう復元する
            if (originalCorsEnv === undefined) {
                delete process.env.CORS_ALLOWED_ORIGINS;
            } else {
                process.env.CORS_ALLOWED_ORIGINS = originalCorsEnv;
            }
        }
    });

    it("T-17_CORSALLOWEDORIGINSがワイルドカード_AccessControlAllowOriginが'*'になる", async () => {
        // Arrange: CORS_ALLOWED_ORIGINS='*' を明示指定し、
        // `if (allowedOrigins.includes('*')) return '*';` の全許可分岐を通す
        // （テスト用途、router.ts のコメント参照）。
        const originalCorsEnv = process.env.CORS_ALLOWED_ORIGINS;
        process.env.CORS_ALLOWED_ORIGINS = '*';

        try {
            // Act
            const res = await router.fetch(
                new Request('http://localhost/health', {
                    headers: { Origin: 'http://anywhere.example' },
                }),
            );

            // Assert
            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
        } finally {
            // Cleanup: 他テストへ影響しないよう復元する
            if (originalCorsEnv === undefined) {
                delete process.env.CORS_ALLOWED_ORIGINS;
            } else {
                process.env.CORS_ALLOWED_ORIGINS = originalCorsEnv;
            }
        }
    });

    it('T-02_不正なJSON_400を返す', async () => {
        // Act
        const res = await postTrigger('{ this is not json');

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: string; message: string };
        expect(json.error).toBe('Bad Request');
        expect(json.message).toBe('Invalid JSON body');
    });

    it('T-03_raceTypesに不正な値を含む_400を返す', async () => {
        // Act
        const res = await postTrigger({ raceTypes: ['invalid-type'] });

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { message: string };
        expect(json.message).toContain('Invalid raceType');
    });

    it('T-04_targetsに不正な列挙値を含む_400を返す', async () => {
        // Act
        const res = await postTrigger({ targets: ['unknown-target'] });

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: string; message: string };
        expect(json.error).toBe('Bad Request');
        expect(json.message).toBe('Invalid JSON body');
    });

    it('T-05_startDateのみ指定_400を返す', async () => {
        // Act
        const res = await postTrigger({ startDate: '2026-01-01' });

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { message: string };
        expect(json.message).toBe(
            'startDate and finishDate must be provided together',
        );
    });

    it('T-05b_finishDateのみ指定_400を返す', async () => {
        // Act
        const res = await postTrigger({ finishDate: '2026-01-02' });

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { message: string };
        expect(json.message).toBe(
            'startDate and finishDate must be provided together',
        );
    });

    it('T-06_startDateの形式が不正_400を返す', async () => {
        // Act
        const res = await postTrigger({
            startDate: '2026/01/01',
            finishDate: '2026-01-02',
        });

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { message: string };
        expect(json.message).toBe(
            'startDate and finishDate must be YYYY-MM-DD',
        );
    });

    it('T-06b_finishDateの形式が不正_400を返す', async () => {
        // Act
        const res = await postTrigger({
            startDate: '2026-01-01',
            finishDate: '2026/01/02',
        });

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { message: string };
        expect(json.message).toBe(
            'startDate and finishDate must be YYYY-MM-DD',
        );
    });

    it('T-07_レンジ上限超過_400を返す', async () => {
        // Arrange: KEIRIN/race は上限 10 日。12 日離すと超過。
        // （NAR は月間ZIP集約により 35 日へ緩和済みのため、ここでは対象外）

        // Act
        const res = await postTrigger({
            raceTypes: ['keirin'],
            targets: ['race'],
            startDate: '2026-01-01',
            finishDate: '2026-01-13',
        });

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { message: string };
        expect(json.message).toContain('Range too large');
    });

    it('T-08_BATCH_ALL_WORKFLOWbinding未設定_500を返す', async () => {
        // Act
        const res = await postTrigger({}, TEST_ENV);

        // Assert
        expect(res.status).toBe(500);
        const json = (await res.json()) as { error: string; message: string };
        expect(json.error).toBe('Internal Server Error');
        expect(json.message).toBe(
            'BATCH_ALL_WORKFLOW binding is not configured',
        );
    });

    it('T-09_ロック取得できない_409を返す', async () => {
        // Arrange
        fetchSpy = installLockFetchSpy({ acquired: false });

        // Act
        const res = await postTrigger(
            {},
            {
                ...TEST_ENV,
                BATCH_ALL_WORKFLOW: createSucceedingWorkflowBinding(),
            },
        );

        // Assert
        expect(res.status).toBe(409);
        const json = (await res.json()) as { error: string; message: string };
        expect(json.error).toBe('Conflict');
        expect(json.message).toBe('他のbatch実行が進行中です');
    });

    it('T-10_全フィールド省略で成功_202とinstanceIdを返す', async () => {
        // Arrange
        fetchSpy = installLockFetchSpy({ acquired: true });

        // Act
        const res = await postTrigger(
            {},
            {
                ...TEST_ENV,
                BATCH_ALL_WORKFLOW: createSucceedingWorkflowBinding(),
            },
        );

        // Assert
        expect(res.status).toBe(202);
        const json = (await res.json()) as {
            success: boolean;
            instanceId: string;
        };
        expect(json.success).toBe(true);
        expect(typeof json.instanceId).toBe('string');
        expect(json.instanceId.length).toBeGreaterThan(0);
    });

    it('T-11_raceTypes_targets_日付を指定して成功_Workflow.createへそのまま渡ること', async () => {
        // Arrange
        fetchSpy = installLockFetchSpy({ acquired: true });
        let capturedParams: unknown;
        const workflowBinding: FakeWorkflowBinding = {
            create: async ({ id, params }) => {
                capturedParams = params;
                return { id };
            },
        };

        // Act
        const res = await postTrigger(
            {
                raceTypes: ['nar'],
                targets: ['race'],
                startDate: '2026-01-01',
                finishDate: '2026-01-05',
            },
            { ...TEST_ENV, BATCH_ALL_WORKFLOW: workflowBinding },
        );

        // Assert
        expect(res.status).toBe(202);
        expect(capturedParams).toEqual({
            raceTypes: ['nar'],
            targets: ['race'],
            startDate: '2026-01-01',
            finishDate: '2026-01-05',
        });
    });

    it('T-12_bodyがnull_400を返す', async () => {
        // Act
        const res = await postTrigger(null);

        // Assert
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: string; message: string };
        expect(json.error).toBe('Bad Request');
        expect(json.message).toBe('Invalid JSON body');
    });
});

/**
 * サービス間認証: ルート分類の回帰防止テスト（SECAUTH-09）
 *
 * batch の免除は `GET /health` と `OPTIONS *` のみ（他はすべて保護対象）。
 * `router.routes` の実ハンドラルートを固定リストと突き合わせ、新しいルートを
 * 追加したときに分類を忘れるとこのテストが落ちる。
 */
describe('サービス間認証: ルート分類の回帰防止（SECAUTH-09）', () => {
    beforeEach(() => {
        process.env.SCRAPING_API_URL = TEST_ENV.SCRAPING_API_URL;
        process.env.MAIN_API_URL = TEST_ENV.MAIN_API_URL;
        process.env.SERVICE_AUTH_TOKEN = MOCK_SERVICE_AUTH_TOKEN;
    });

    afterEach(() => {
        EnvStore.reset();
    });

    const concreteRoutes = router.routes.filter(
        (route) => route.method !== 'ALL' && !route.path.endsWith('/*'),
    );

    const routeKey = (route: { method: string; path: string }): string =>
        `${route.method} ${route.path}`;

    const EXPECTED_EXEMPT_ROUTE_KEYS = ['GET /health'];

    const EXPECTED_PROTECTED_ROUTE_KEYS = ['POST /batch/trigger'];

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

    it('主要な保護ルート（POST /batch/trigger）はトークン無しで401になること', async () => {
        const res = await router.request('/batch/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(401);
    });

    it('公開ルート（GET /health）はトークン無しでも200系になること', async () => {
        const res = await router.request('/health');

        expect(res.status).toBeLessThan(300);
    });
});
