/**
 * batchLockController.test.ts - BatchLockController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド  | 条件                          | 期待値 |
 * |---|-----------|-------------------------------|--------|
 * | 1 | acquire   | 正常なbody・usecaseがacquired:true | 200 + { acquired: true } |
 * | 2 | acquire   | 正常なbody・usecaseがacquired:false | 409 + { error, message } |
 * | 3 | acquire   | bodyが不正（instanceId欠落）  | 400 |
 * | 4 | acquire   | usecase例外                    | 500 |
 * | 5 | release   | 正常なbody                     | 200 + { success: true } |
 * | 6 | release   | bodyが不正（instanceId欠落）    | 400 |
 * | 7 | release   | usecase例外                    | 500 |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';

import { BatchLockController } from '../../../src/controller/batchLockController';
import type { IBatchLockUsecase } from '../../../src/usecase/interface/IBatchLockUsecase';

interface MockBatchLockUsecase {
    acquire: Mock<IBatchLockUsecase['acquire']>;
    release: Mock<IBatchLockUsecase['release']>;
}

const createMockUsecase = (
    overrides: Partial<MockBatchLockUsecase> = {},
): MockBatchLockUsecase => ({
    acquire: mock(() => Promise.resolve({ acquired: true })),
    release: mock(() => Promise.resolve(undefined)),
    ...overrides,
});

describe('api/controller/BatchLockController', () => {
    describe('acquire', () => {
        it('1: 正常なbody・acquired:trueの場合は200を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new BatchLockController(usecase);
            const req = new Request(
                'http://localhost/internal/batch-lock/acquire',
                {
                    method: 'POST',
                    body: JSON.stringify({ instanceId: 'instance-1' }),
                },
            );

            const res = await controller.acquire(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as { acquired: boolean };
            expect(body.acquired).toBe(true);
        });

        it('2: 正常なbody・acquired:falseの場合は409を返すこと', async () => {
            const usecase = createMockUsecase({
                acquire: mock(() => Promise.resolve({ acquired: false })),
            });
            const controller = new BatchLockController(usecase);
            const req = new Request(
                'http://localhost/internal/batch-lock/acquire',
                {
                    method: 'POST',
                    body: JSON.stringify({ instanceId: 'instance-1' }),
                },
            );

            const res = await controller.acquire(req);

            expect(res.status).toBe(409);
        });

        it('3: bodyが不正（instanceId欠落）の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new BatchLockController(usecase);
            const req = new Request(
                'http://localhost/internal/batch-lock/acquire',
                {
                    method: 'POST',
                    body: JSON.stringify({}),
                },
            );

            const res = await controller.acquire(req);

            expect(res.status).toBe(400);
        });

        it('4: usecase.acquireが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                acquire: mock(() => Promise.reject(new Error('boom'))),
            });
            const controller = new BatchLockController(usecase);
            const req = new Request(
                'http://localhost/internal/batch-lock/acquire',
                {
                    method: 'POST',
                    body: JSON.stringify({ instanceId: 'instance-1' }),
                },
            );

            const res = await controller.acquire(req);

            expect(res.status).toBe(500);
        });
    });

    describe('release', () => {
        it('5: 正常なbodyの場合は200とsuccess:trueを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new BatchLockController(usecase);
            const req = new Request(
                'http://localhost/internal/batch-lock/release',
                {
                    method: 'POST',
                    body: JSON.stringify({ instanceId: 'instance-1' }),
                },
            );

            const res = await controller.release(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('6: bodyが不正（instanceId欠落）の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new BatchLockController(usecase);
            const req = new Request(
                'http://localhost/internal/batch-lock/release',
                {
                    method: 'POST',
                    body: JSON.stringify({}),
                },
            );

            const res = await controller.release(req);

            expect(res.status).toBe(400);
        });

        it('7: usecase.releaseが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                release: mock(() => Promise.reject(new Error('boom'))),
            });
            const controller = new BatchLockController(usecase);
            const req = new Request(
                'http://localhost/internal/batch-lock/release',
                {
                    method: 'POST',
                    body: JSON.stringify({ instanceId: 'instance-1' }),
                },
            );

            const res = await controller.release(req);

            expect(res.status).toBe(500);
        });
    });
});
