/**
 * batch.post.router.component.test.ts
 *
 * BATCH-TRIGGER-1 ~ BATCH-TRIGGER-2: POST /batch/trigger エンドポイントの
 * コンポーネントテスト（BEHAV-018、CICD-73/CONC-03でPOST /batchから統合）。
 *
 * batch には controller 層が無く router.ts がその役割を兼務するため、
 * 「router → バリデーション → ロック取得（api Worker）→ Workflowインスタンス作成」の
 * 配線を実HTTP経由で検証する。各バリデーション分岐の網羅は
 * `test/unittest/router.test.ts`（T-01〜T-13）に委ね、ここでは
 * 「配線1パターンにつき代表1本」（正常系 + 認証拒否）に絞る
 * （component-tests skill §1 準拠）。api Worker（ロックエンドポイント）への実HTTP呼び出しは
 * グローバル `fetch` をモックして避ける（api側の配線検証はapiパッケージのコンポーネント
 * テストに委ねる）。
 *
 * ## シナリオテーブル
 *
 * | #                | リクエスト条件                              | 期待                                          |
 * |--------------------|--------------------------------------------|-------------------------------------------------|
 * | BATCH-TRIGGER-1   | 認証ヘッダーあり・ロック取得成功・正当なボディ | 202・success:true・instanceIdを返す            |
 * | BATCH-TRIGGER-2   | 認証ヘッダー無し                             | 401（`requireServiceAuth`で拒否）                |
 * | BATCH-HEALTH-1    | GET /health（認証不要・監視用）              | 200（BEHAV-019）                                |
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { EnvStore, SERVICE_AUTH_HEADER } from '@race-schedule/core';

import { router } from '../../../src/router';

const MOCK_SERVICE_AUTH_TOKEN = 'mock-service-auth-token';

const TEST_ENV = {
    SCRAPING_API_URL: 'http://scraping.test',
    MAIN_API_URL: 'http://main.test',
};

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

interface MockResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
}

/** api Worker の `/internal/batch-lock/acquire` への応答（常にロック取得成功）をモックする。 */
const lockAcquiredOk = (): MockResponse => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ acquired: true }),
    json: async () => ({ acquired: true }),
});

describe('コンポーネントテスト: Batch Trigger Router → バリデーション → ロック取得 → Workflow作成', () => {
    let fetchSpy: ReturnType<typeof spyOn> | undefined;

    beforeEach(() => {
        process.env.SCRAPING_API_URL = TEST_ENV.SCRAPING_API_URL;
        process.env.MAIN_API_URL = TEST_ENV.MAIN_API_URL;
        process.env.SERVICE_AUTH_TOKEN = MOCK_SERVICE_AUTH_TOKEN;
    });

    afterEach(() => {
        fetchSpy?.mockRestore();
        fetchSpy = undefined;
        EnvStore.reset();
    });

    it('BATCH-TRIGGER-1: 認証ヘッダーあり_ロック取得成功で202とinstanceIdを返すこと', async () => {
        // Arrange: api Workerのロック取得エンドポイントへの実HTTP呼び出しをモック
        fetchSpy = spyOn(globalThis, 'fetch');
        fetchSpy.mockImplementation((async () =>
            lockAcquiredOk()) as unknown as typeof fetch);

        // Act
        const response = await router.request(
            '/batch/trigger',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
                },
                body: JSON.stringify({
                    raceTypes: ['nar'],
                    targets: ['place'],
                    startDate: '2026-01-01',
                    finishDate: '2026-01-05',
                }),
            },
            {
                ...TEST_ENV,
                BATCH_ALL_WORKFLOW: createSucceedingWorkflowBinding(),
            },
        );
        const body = (await response.json()) as {
            success: boolean;
            instanceId: string;
        };

        // Assert
        expect(response.status).toBe(202);
        expect(body.success).toBe(true);
        expect(typeof body.instanceId).toBe('string');
    });

    it('BATCH-TRIGGER-2: 認証ヘッダー無し_401を返すこと', async () => {
        // Act
        const response = await router.request(
            '/batch/trigger',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    raceTypes: ['nar'],
                    targets: ['place'],
                    startDate: '2026-01-01',
                    finishDate: '2026-01-05',
                }),
            },
            TEST_ENV,
        );

        // Assert
        expect(response.status).toBe(401);
    });

    it('BATCH-HEALTH-1: GET /healthが認証無しで200を返すこと', async () => {
        // Act
        const response = await router.request('/health');

        // Assert
        expect(response.status).toBe(200);
    });
});
