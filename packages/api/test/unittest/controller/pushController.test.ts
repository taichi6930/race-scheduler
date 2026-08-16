/**
 * pushController.test.ts - PushController ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | メソッド            | 条件                            | 期待値 |
 * |---|---------------------|----------------------------------|--------|
 * | 1 | subscriptionUpsert  | 正常なbody（新規発行、usecaseが`{ ok:true, id, secret }`） | 200 + { id, secret } |
 * | 2 | subscriptionUpsert  | bodyが不正（keys欠落）           | 400    |
 * | 3 | subscriptionUpsert  | usecase例外                      | 500    |
 * | 1f| subscriptionUpsert  | X-Push-Subscription-Secretヘッダーあり（usecaseが`{ ok:true, id }`、secretなし） | 200 + { id }（secretキー無し） |
 * | 1g| subscriptionUpsert  | usecaseが`{ ok:false }`を返す     | 401    |
 * | 4 | subscriptionRemove  | 正常なbody                       | 200 + { success: true } |
 * | 5 | subscriptionRemove  | bodyが不正（endpointがURLでない）| 400    |
 * | 6 | subscriptionRemove  | usecase例外                      | 500    |
 * | 7 | requestUpsert       | 正常なbody                       | 200 + { success: true } |
 * | 8 | requestUpsert       | bodyが不正（fireAtMsが負）       | 400    |
 * | 9 | requestUpsert       | raceId形式が不正                 | 400    |
 * | 10| requestUpsert       | usecase例外                      | 500    |
 * | 11| requestRemove       | 正常なbody                       | 200 + { success: true } |
 * | 12| requestRemove       | bodyが不正（subscriptionId欠落） | 400    |
 * | 13| requestRemove       | raceId形式が不正                 | 400    |
 * | 14| requestRemove       | usecase例外                      | 500    |
 * | 15| dispatch            | トークン一致                     | 200 + PushDispatchResult |
 * | 16| dispatch            | トークンヘッダーなし             | 401    |
 * | 17| dispatch            | トークン不一致                   | 401    |
 * | 18| dispatch            | PUSH_DISPATCH_TOKEN未設定        | 401    |
 * | 19| dispatch            | usecase例外                      | 500    |
 * | 20| sendTest            | 正常なbody                       | 200 + PushTestSendResult |
 * | 21| sendTest            | bodyが不正（subscriptionId欠落） | 400    |
 * | 22| sendTest            | usecase例外                      | 500    |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import type { CloudFlareEnv } from '@race-schedule/core';
import { EnvStore } from '@race-schedule/core';
import 'reflect-metadata';

import { afterEach, describe, expect, it, type Mock, mock } from 'bun:test';

import { PushController } from '../../../src/controller/pushController';
import type {
    IPushUsecase,
    PushDispatchResult,
    PushTestSendResult,
} from '../../../src/usecase/interface/IPushUsecase';

interface MockPushUsecase {
    upsertSubscription: Mock<IPushUsecase['upsertSubscription']>;
    removeSubscription: Mock<IPushUsecase['removeSubscription']>;
    upsertRequest: Mock<IPushUsecase['upsertRequest']>;
    removeRequest: Mock<IPushUsecase['removeRequest']>;
    dispatchDue: Mock<IPushUsecase['dispatchDue']>;
    sendTest: Mock<IPushUsecase['sendTest']>;
    purgeStaleSubscriptions: Mock<IPushUsecase['purgeStaleSubscriptions']>;
}

const DEFAULT_DISPATCH_RESULT: PushDispatchResult = {
    attempted: 0,
    sent: 0,
    gone: 0,
    failed: 0,
};

const createMockUsecase = (
    overrides: Partial<MockPushUsecase> = {},
): MockPushUsecase => ({
    upsertSubscription: mock(() =>
        Promise.resolve({ ok: true, id: 'sub-1', secret: 'secret-1' }),
    ),
    removeSubscription: mock(() => Promise.resolve(undefined)),
    upsertRequest: mock(() => Promise.resolve(undefined)),
    removeRequest: mock(() => Promise.resolve(undefined)),
    dispatchDue: mock(() => Promise.resolve(DEFAULT_DISPATCH_RESULT)),
    sendTest: mock(() => Promise.resolve({ ok: true })),
    purgeStaleSubscriptions: mock(() => Promise.resolve(0)),
    ...overrides,
});

describe('api/controller/PushController', () => {
    describe('subscriptionUpsert', () => {
        it('1: 正常なbody（新規発行）の場合は200とid・secretを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/subscription', {
                method: 'POST',
                body: JSON.stringify({
                    endpoint: 'https://push.example.com/subscription/abc',
                    keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
                }),
            });

            const res = await controller.subscriptionUpsert(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                id: string;
                secret?: string;
            };
            expect(body.id).toBe('sub-1');
            expect(body.secret).toBe('secret-1');
        });

        it('1f: 既存購読の更新（usecaseがsecretなしを返す）の場合は応答にsecretキーを含まないこと', async () => {
            const usecase = createMockUsecase({
                upsertSubscription: mock(() =>
                    Promise.resolve({ ok: true, id: 'sub-1' }),
                ),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/subscription', {
                method: 'POST',
                headers: { 'X-Push-Subscription-Secret': 'presented-secret' },
                body: JSON.stringify({
                    endpoint: 'https://push.example.com/subscription/abc',
                    keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
                }),
            });

            const res = await controller.subscriptionUpsert(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as Record<string, unknown>;
            expect(body.id).toBe('sub-1');
            expect('secret' in body).toBe(false);
        });

        it('1g: usecaseが{ ok: false }を返す場合は401を返すこと', async () => {
            const usecase = createMockUsecase({
                upsertSubscription: mock(() =>
                    Promise.resolve({ ok: false as const }),
                ),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/subscription', {
                method: 'POST',
                body: JSON.stringify({
                    endpoint: 'https://push.example.com/subscription/abc',
                    keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
                }),
            });

            const res = await controller.subscriptionUpsert(req);

            expect(res.status).toBe(401);
        });

        it('2: bodyが不正（keys欠落）の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/subscription', {
                method: 'POST',
                body: JSON.stringify({
                    endpoint: 'https://push.example.com/subscription/abc',
                }),
            });

            const res = await controller.subscriptionUpsert(req);

            expect(res.status).toBe(400);
        });

        it('3: usecase.upsertSubscriptionが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                upsertSubscription: mock(() =>
                    Promise.reject(new Error('boom')),
                ),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/subscription', {
                method: 'POST',
                body: JSON.stringify({
                    endpoint: 'https://push.example.com/subscription/abc',
                    keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
                }),
            });

            const res = await controller.subscriptionUpsert(req);

            expect(res.status).toBe(500);
        });
    });

    describe('subscriptionRemove', () => {
        it('4: 正常なbodyの場合は200とsuccess:trueを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/subscription', {
                method: 'DELETE',
                body: JSON.stringify({
                    endpoint: 'https://push.example.com/subscription/abc',
                }),
            });

            const res = await controller.subscriptionRemove(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('5: bodyが不正（endpointがURLでない）の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/subscription', {
                method: 'DELETE',
                body: JSON.stringify({ endpoint: 'not-a-url' }),
            });

            const res = await controller.subscriptionRemove(req);

            expect(res.status).toBe(400);
        });

        it('6: usecase.removeSubscriptionが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                removeSubscription: mock(() =>
                    Promise.reject(new Error('boom')),
                ),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/subscription', {
                method: 'DELETE',
                body: JSON.stringify({
                    endpoint: 'https://push.example.com/subscription/abc',
                }),
            });

            const res = await controller.subscriptionRemove(req);

            expect(res.status).toBe(500);
        });
    });

    describe('requestUpsert', () => {
        const baseBody = {
            subscriptionId: 'sub-1',
            raceId: 'jra202601010101',
            fireAtMs: 1_700_000_000_000,
            title: '皐月賞（GⅠ）',
            body: '中山 11R ・ 発走 5分前',
        };

        it('7: 正常なbodyの場合は200とsuccess:trueを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/request', {
                method: 'POST',
                body: JSON.stringify(baseBody),
            });

            const res = await controller.requestUpsert(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('8: bodyが不正（fireAtMsが負）の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/request', {
                method: 'POST',
                body: JSON.stringify({ ...baseBody, fireAtMs: -1 }),
            });

            const res = await controller.requestUpsert(req);

            expect(res.status).toBe(400);
        });

        it('9: raceIdの形式が不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/request', {
                method: 'POST',
                body: JSON.stringify({
                    ...baseBody,
                    raceId: 'not-a-valid-race-id',
                }),
            });

            const res = await controller.requestUpsert(req);

            expect(res.status).toBe(400);
        });

        it('10: usecase.upsertRequestが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                upsertRequest: mock(() => Promise.reject(new Error('boom'))),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/request', {
                method: 'POST',
                body: JSON.stringify(baseBody),
            });

            const res = await controller.requestUpsert(req);

            expect(res.status).toBe(500);
        });
    });

    describe('requestRemove', () => {
        const baseBody = {
            subscriptionId: 'sub-1',
            raceId: 'jra202601010101',
        };

        it('11: 正常なbodyの場合は200とsuccess:trueを返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/request', {
                method: 'DELETE',
                body: JSON.stringify(baseBody),
            });

            const res = await controller.requestRemove(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('12: bodyが不正（subscriptionId欠落）の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/request', {
                method: 'DELETE',
                body: JSON.stringify({ raceId: 'jra202601010101' }),
            });

            const res = await controller.requestRemove(req);

            expect(res.status).toBe(400);
        });

        it('13: raceIdの形式が不正な場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/request', {
                method: 'DELETE',
                body: JSON.stringify({
                    ...baseBody,
                    raceId: 'not-a-valid-race-id',
                }),
            });

            const res = await controller.requestRemove(req);

            expect(res.status).toBe(400);
        });

        it('14: usecase.removeRequestが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                removeRequest: mock(() => Promise.reject(new Error('boom'))),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/request', {
                method: 'DELETE',
                body: JSON.stringify(baseBody),
            });

            const res = await controller.requestRemove(req);

            expect(res.status).toBe(500);
        });
    });

    describe('dispatch', () => {
        afterEach(() => {
            EnvStore.reset();
        });

        const setDispatchToken = (token: string | undefined): void => {
            EnvStore.setEnv({
                PUSH_DISPATCH_TOKEN: token,
            } as unknown as CloudFlareEnv);
        };

        it('15: トークンが一致する場合は200とディスパッチ結果を返すこと', async () => {
            setDispatchToken('secret-token');
            const dispatchResult: PushDispatchResult = {
                attempted: 3,
                sent: 2,
                gone: 1,
                failed: 0,
            };
            const usecase = createMockUsecase({
                dispatchDue: mock(() => Promise.resolve(dispatchResult)),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/dispatch', {
                method: 'POST',
                headers: { 'X-Push-Dispatch-Token': 'secret-token' },
            });

            const res = await controller.dispatch(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as PushDispatchResult;
            expect(body).toEqual(dispatchResult);
        });

        it('16: トークンヘッダーが無い場合は401を返すこと', async () => {
            setDispatchToken('secret-token');
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/dispatch', {
                method: 'POST',
            });

            const res = await controller.dispatch(req);

            expect(res.status).toBe(401);
        });

        it('17: トークンが不一致の場合は401を返すこと', async () => {
            setDispatchToken('secret-token');
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/dispatch', {
                method: 'POST',
                headers: { 'X-Push-Dispatch-Token': 'wrong-token' },
            });

            const res = await controller.dispatch(req);

            expect(res.status).toBe(401);
        });

        it('18: PUSH_DISPATCH_TOKENが未設定の場合は401を返すこと', async () => {
            setDispatchToken(undefined);
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/dispatch', {
                method: 'POST',
                headers: { 'X-Push-Dispatch-Token': 'anything' },
            });

            const res = await controller.dispatch(req);

            expect(res.status).toBe(401);
        });

        it('19: usecase.dispatchDueが例外を投げた場合は500を返すこと', async () => {
            setDispatchToken('secret-token');
            const usecase = createMockUsecase({
                dispatchDue: mock(() => Promise.reject(new Error('boom'))),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/dispatch', {
                method: 'POST',
                headers: { 'X-Push-Dispatch-Token': 'secret-token' },
            });

            const res = await controller.dispatch(req);

            expect(res.status).toBe(500);
        });
    });

    describe('sendTest', () => {
        it('20: 正常なbodyの場合は200とPushTestSendResultを返すこと', async () => {
            const sendTestResult: PushTestSendResult = { ok: true };
            const usecase = createMockUsecase({
                sendTest: mock(() => Promise.resolve(sendTestResult)),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/test', {
                method: 'POST',
                body: JSON.stringify({ subscriptionId: 'sub-1' }),
            });

            const res = await controller.sendTest(req);

            expect(res.status).toBe(200);
            const body = (await res.json()) as PushTestSendResult;
            expect(body).toEqual(sendTestResult);
        });

        it('21: bodyが不正（subscriptionId欠落）の場合は400を返すこと', async () => {
            const usecase = createMockUsecase();
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/test', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            const res = await controller.sendTest(req);

            expect(res.status).toBe(400);
        });

        it('22: usecase.sendTestが例外を投げた場合は500を返すこと', async () => {
            const usecase = createMockUsecase({
                sendTest: mock(() => Promise.reject(new Error('boom'))),
            });
            const controller = new PushController(usecase);
            const req = new Request('http://localhost/push/test', {
                method: 'POST',
                body: JSON.stringify({ subscriptionId: 'sub-1' }),
            });

            const res = await controller.sendTest(req);

            expect(res.status).toBe(500);
        });
    });
});
