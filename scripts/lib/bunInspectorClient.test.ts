/**
 * bunInspectorClient.ts の自己テスト
 *
 * 実際に bun でローカル WebSocket サーバー（`Bun.serve` の `websocket` ハンドラ）を立て、
 * ハンドシェイク（設計書 §2.1）とイベント収集・close 待ち（§2.5）を実際のネットワーク
 * 通信で検証する（モックによる代替はプロトコルの取り違えを検出できないため避ける）。
 *
 * ## デシジョンテーブル
 *
 * ### isRelevantInspectorMethod
 * | # | method | 期待 |
 * |---|--------|------|
 * | T-01 | TestReporter.found/start/end, LifecycleReporter.error, Console.messageAdded | true |
 * | T-02 | Debugger.scriptParsed 等の対象外イベント | false |
 *
 * ### runInspectorSession
 * | # | サーバーの挙動 | 期待 |
 * |---|----------------|------|
 * | T-03 | ハンドシェイク完了後にイベント2件を送りclose | connected=true、対象外イベントを除いた2件を受信、tが付与される |
 * | T-04 | Debugger.scriptParsed 等の対象外イベントも送る | onEventに渡らない |
 * | T-05 | 接続先が存在しない（接続不可） | connectTimeoutMs予算内でconnected=falseを返す |
 */
import { describe, expect, it } from 'bun:test';

import {
    formatInspectorEventLine,
    isRelevantInspectorMethod,
    runInspectorSession,
    toInspectorEvent,
} from './bunInspectorClient';

describe('isRelevantInspectorMethod', () => {
    it.each([
        ['TestReporter.found'],
        ['TestReporter.start'],
        ['TestReporter.end'],
        ['LifecycleReporter.error'],
        ['Console.messageAdded'],
    ])('[T-01] %s は収集対象', (method) => {
        expect(isRelevantInspectorMethod(method)).toBe(true);
    });

    it.each([
        ['Debugger.scriptParsed'],
        ['Runtime.enable'],
        ['Unknown.method'],
    ])('[T-02] %s は収集対象外', (method) => {
        expect(isRelevantInspectorMethod(method)).toBe(false);
    });
});

describe('toInspectorEvent / formatInspectorEventLine', () => {
    it('イベントをJSONL1行にフォーマットできる', () => {
        const event = toInspectorEvent(123, 'TestReporter.start', { id: 1 });

        expect(formatInspectorEventLine(event)).toBe(
            '{"t":123,"m":"TestReporter.start","p":{"id":1}}',
        );
    });
});

interface HandshakeAwareServer {
    stop: () => void;
    port: number;
}

/** ハンドシェイク5件を受け取ったら送信し、その後closeするモックInspectorサーバー */
const startMockInspectorServer = (
    afterHandshake: (ws: import('bun').ServerWebSocket<unknown>) => void,
): HandshakeAwareServer => {
    let messageCount = 0;
    const server = Bun.serve({
        port: 0,
        fetch(req, srv) {
            if (srv.upgrade(req)) return;
            return new Response('upgrade failed', { status: 500 });
        },
        websocket: {
            message(ws) {
                messageCount++;
                if (messageCount === 5) afterHandshake(ws);
            },
        },
    });
    if (server.port === undefined) {
        throw new Error('failed to obtain an ephemeral port from Bun.serve');
    }
    return { stop: () => server.stop(true), port: server.port };
};

describe('runInspectorSession', () => {
    it('[T-03][T-04] ハンドシェイク後のイベントを収集し、対象外イベントは除外する', async () => {
        const server = startMockInspectorServer((ws) => {
            ws.send(
                JSON.stringify({
                    method: 'Debugger.scriptParsed',
                    params: { scriptId: '1' },
                }),
            );
            ws.send(
                JSON.stringify({
                    method: 'TestReporter.found',
                    params: { id: 1, name: 'a', type: 'test' },
                }),
            );
            ws.send(
                JSON.stringify({
                    method: 'TestReporter.end',
                    params: { id: 1, status: 'pass', elapsed: 100 },
                }),
            );
            ws.close();
        });

        const received: unknown[] = [];
        const result = await runInspectorSession({
            url: `ws://localhost:${server.port}/test`,
            onEvent: (e) => received.push(e),
        });
        server.stop();

        expect(result.connected).toBe(true);
        expect(received).toHaveLength(2);
        // SAFETY: 上のfakeサーバーがTestReporter.found/endの2件のみを送信しており、
        // runInspectorSessionのonEventはInspectorEvent({t, m, p})を渡す契約のため、
        // received[0]は既知の形状を持つ
        expect((received[0] as { m: string }).m).toBe('TestReporter.found');
        // SAFETY: 同上（fakeサーバーが送信した2件目はTestReporter.end）
        expect((received[1] as { m: string }).m).toBe('TestReporter.end');
        // SAFETY: 同上（received[0]はInspectorEvent形状のためtフィールドを持つ）
        expect((received[0] as { t: number }).t).toEqual(expect.any(Number));
    });

    it('[T-05] 接続できない場合はタイムアウト予算内でconnected=falseを返す', async () => {
        const result = await runInspectorSession({
            url: 'ws://127.0.0.1:1/unreachable',
            connectTimeoutMs: 500,
            onEvent: () => {
                throw new Error('should not receive events');
            },
        });

        expect(result.connected).toBe(false);
    });
});
