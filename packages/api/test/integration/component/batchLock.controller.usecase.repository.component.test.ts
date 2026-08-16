/**
 * batchLock.controller.usecase.repository.component.test.ts
 *
 * BATCH-LOCK-1/2: POST /internal/batch-lock/acquire・/release エンドポイントの
 * コンポーネントテスト（CICD-73/CONC-03）。
 *
 * 層構造: Router（実HTTP） → BatchLockController → BatchLockUsecase → BatchLockRepository → InMemory D1（Drizzle）
 *
 * ## シナリオテーブル
 *
 * | #             | 事前状態           | リクエスト             | 期待                          |
 * |----------------|--------------------|--------------------------|-------------------------------|
 * | BATCH-LOCK-1   | ロック空き         | acquire（instance-1）    | 200・acquired:true            |
 * | BATCH-LOCK-2   | instance-1が保持中 | acquire（instance-2）    | 409（他インスタンスが実行中）  |
 * | BATCH-LOCK-3   | instance-1が保持中 | release（instance-1）    | 200・以降instance-2がacquire可 |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { SERVICE_AUTH_HEADER } from '@race-schedule/core';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

describe('コンポーネントテスト: BatchLock Router → Controller → Usecase → Repository → InMemory D1', () => {
    let d1: D1Database;

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    const acquire = (instanceId: string) =>
        requestApi(d1, '/internal/batch-lock/acquire', {
            method: 'POST',
            headers: {
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ instanceId }),
        });

    const release = (instanceId: string) =>
        requestApi(d1, '/internal/batch-lock/release', {
            method: 'POST',
            headers: {
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ instanceId }),
        });

    it('BATCH-LOCK-1: ロックが空きの場合はacquireが200・acquired:trueを返すこと', async () => {
        const response = await acquire('instance-1');
        const body = (await response.json()) as { acquired: boolean };

        expect(response.status).toBe(200);
        expect(body.acquired).toBe(true);
    });

    it('BATCH-LOCK-2: 他インスタンスが保持中の場合はacquireが409を返すこと', async () => {
        await acquire('instance-1');

        const response = await acquire('instance-2');

        expect(response.status).toBe(409);
    });

    it('BATCH-LOCK-3: releaseで解放後は別インスタンスがacquireできること', async () => {
        await acquire('instance-1');
        await release('instance-1');

        const response = await acquire('instance-2');
        const body = (await response.json()) as { acquired: boolean };

        expect(response.status).toBe(200);
        expect(body.acquired).toBe(true);
    });
});
