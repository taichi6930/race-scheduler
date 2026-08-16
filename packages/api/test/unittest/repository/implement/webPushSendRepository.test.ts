/**
 * webPushSendRepository.test.ts - WebPushSendRepository ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | # | 条件                              | 期待される動作                                      |
 * |---|------------------------------------|-------------------------------------------------------|
 * | 1 | send呼び出し（dispatchCache省略）  | gateway.sendへsubscription/payload/undefinedを渡して委譲し結果を返す |
 * | 2 | send呼び出し（dispatchCache指定）  | gateway.sendへ同じdispatchCache参照を渡して委譲する（PERF-104） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import { describe, expect, it, mock } from 'bun:test';
import 'reflect-metadata';

import type {
    IWebPushGateway,
    WebPushDispatchCache,
} from '../../../../src/gateway/interface/IWebPushGateway';
import { WebPushSendRepository } from '../../../../src/repository/implement/webPushSendRepository';

describe('WebPushSendRepository', () => {
    it('1: sendはgatewayへsubscription/payloadを渡して委譲し結果を返すこと', async () => {
        const webPushGateway: IWebPushGateway = {
            send: mock(() => Promise.resolve({ ok: true as const })),
        };
        const repository = new WebPushSendRepository(webPushGateway);
        const subscription = {
            endpoint: 'https://push.example.com/subscription/1',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
        };
        const payload = { title: 'タイトル', body: '本文' };

        const result = await repository.send(subscription, payload);

        expect(webPushGateway.send).toHaveBeenCalledWith(
            subscription,
            payload,
            undefined,
        );
        expect(result).toEqual({ ok: true });
    });

    it('2: dispatchCacheが指定された場合、同じ参照をgateway.sendへ渡すこと', async () => {
        const webPushGateway: IWebPushGateway = {
            send: mock(() => Promise.resolve({ ok: true as const })),
        };
        const repository = new WebPushSendRepository(webPushGateway);
        const subscription = {
            endpoint: 'https://push.example.com/subscription/2',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
        };
        const payload = { title: 'タイトル', body: '本文' };
        const dispatchCache: WebPushDispatchCache = {};

        await repository.send(subscription, payload, dispatchCache);

        expect(webPushGateway.send).toHaveBeenCalledWith(
            subscription,
            payload,
            dispatchCache,
        );
    });
});
