/**
 * Batch Router エラーハンドリング（500）テスト
 *
 * `client/batchLock.ts`（acquireBatchLock/releaseBatchLock）が例外を投げるケースは
 * 通常の HTTP レスポンス（409 等）では再現できないため、mock.module でモジュールを
 * 差し替えて例外を送出させ、router の catch 節（500 応答）をカバーする。
 *
 * mock.module は同一プロセス内でモジュールレジストリを共有するため、本ファイル
 * 完了時（afterAll）に本来の実装へ復元し、他テストファイルへ影響させない。
 *
 * ## デシジョンテーブル（router catch）
 *
 * | #    | 条件                                                      | 期待結果                                       |
 * |------|-------------------------------------------------------------|---------------------------------------------------|
 * | E-01 | acquireBatchLock が throw                                   | 500 status:500・汎用メッセージ（SEC-017）        |
 * | E-02 | workflowBinding.create が throw（ロック取得は成功）          | 500・汎用メッセージ・releaseBatchLockが呼ばれる  |
 * | E-03 | workflowBinding.create もreleaseBatchLockもthrow             | 500・汎用メッセージ（releaseの失敗は握り潰す）   |
 */

import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    mock,
} from 'bun:test';
import { SERVICE_AUTH_HEADER } from '@race-schedule/core';

// モック適用前に本来の実装を捕捉（復元用）
const realBatchLock = await import('../../src/client/batchLock');
const realAcquireBatchLock = realBatchLock.acquireBatchLock;
const realReleaseBatchLock = realBatchLock.releaseBatchLock;

interface MockLockControl {
    acquireImpl: () => Promise<{ acquired: boolean }>;
    releaseImpl: (instanceId: string) => Promise<void>;
    releaseCalls: string[];
}

const control: MockLockControl = {
    acquireImpl: async () => ({ acquired: true }),
    releaseImpl: async (instanceId: string): Promise<void> => {
        control.releaseCalls.push(instanceId);
    },
    releaseCalls: [],
};

mock.module('../../src/client/batchLock', () => ({
    acquireBatchLock: async (): Promise<{ acquired: boolean }> =>
        control.acquireImpl(),
    releaseBatchLock: async (instanceId: string): Promise<void> =>
        control.releaseImpl(instanceId),
}));

// mock.module 適用後に router を取得（router 内の live binding がモックを参照）
const { router } = await import('../../src/router');

afterAll(() => {
    // 本来の実装へ復元（他ファイルの live binding も実装へ戻る）
    mock.module('../../src/client/batchLock', () => ({
        acquireBatchLock: realAcquireBatchLock,
        releaseBatchLock: realReleaseBatchLock,
    }));
});

const MOCK_SERVICE_AUTH_TOKEN = 'mock-service-auth-token';

const TEST_ENV = {
    SCRAPING_API_URL: 'http://scraping.test',
    MAIN_API_URL: 'http://main.test',
    SERVICE_AUTH_TOKEN: MOCK_SERVICE_AUTH_TOKEN,
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

const createThrowingWorkflowBinding = (): FakeWorkflowBinding => ({
    create: async () => {
        throw new Error('workflow create failed');
    },
});

const postTrigger = async (
    body: unknown,
    env: Record<string, unknown>,
): Promise<Response> =>
    router.request(
        '/batch/trigger',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify(body),
        },
        env,
    );

const defaultReleaseImpl = async (instanceId: string): Promise<void> => {
    control.releaseCalls.push(instanceId);
};

describe('router catch', () => {
    beforeEach(() => {
        control.acquireImpl = async () => ({ acquired: true });
        control.releaseImpl = defaultReleaseImpl;
        control.releaseCalls = [];
    });

    afterEach(() => {
        control.acquireImpl = async () => ({ acquired: true });
        control.releaseImpl = defaultReleaseImpl;
        control.releaseCalls = [];
    });

    it('E-01_acquireBatchLockがthrow_500と汎用メッセージを返す', async () => {
        // Arrange
        control.acquireImpl = async () => {
            throw new Error('acquire failed');
        };

        // Act
        const res = await postTrigger(
            {},
            {
                ...TEST_ENV,
                BATCH_ALL_WORKFLOW: createSucceedingWorkflowBinding(),
            },
        );

        // Assert
        expect(res.status).toBe(500);
        const json = (await res.json()) as { status: number; message: string };
        expect(json.status).toBe(500);
        // サービス間認証済み（SERVICE_AUTH_HEADER）のためエラー詳細を含む
        expect(json.message).toBe('Error: acquire failed');
    });

    it('E-02_workflowBinding_createがthrow_500を返しreleaseBatchLockが呼ばれる', async () => {
        // Act
        const res = await postTrigger(
            {},
            {
                ...TEST_ENV,
                BATCH_ALL_WORKFLOW: createThrowingWorkflowBinding(),
            },
        );

        // Assert
        expect(res.status).toBe(500);
        const json = (await res.json()) as { status: number; message: string };
        expect(json.status).toBe(500);
        // サービス間認証済み（SERVICE_AUTH_HEADER）のためエラー詳細を含む
        expect(json.message).toBe('Error: workflow create failed');
        expect(control.releaseCalls).toHaveLength(1);
    });

    it('E-03_workflowBinding_createもreleaseBatchLockもthrow_releaseの失敗を握り潰し500を返す', async () => {
        // Arrange
        control.releaseImpl = async () => {
            throw new Error('release failed');
        };

        // Act
        const res = await postTrigger(
            {},
            {
                ...TEST_ENV,
                BATCH_ALL_WORKFLOW: createThrowingWorkflowBinding(),
            },
        );

        // Assert
        expect(res.status).toBe(500);
        const json = (await res.json()) as { status: number; message: string };
        expect(json.status).toBe(500);
        // release自体の失敗（'release failed'）ではなく、元のcreate失敗の詳細を
        // 返す（release失敗は握り潰され、releaseの実装詳細を漏らさない）
        expect(json.message).toBe('Error: workflow create failed');
    });
});
