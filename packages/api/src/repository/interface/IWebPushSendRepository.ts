import type {
    WebPushDispatchCache,
    WebPushPayload,
    WebPushSendResult,
    WebPushSubscriptionKeys,
} from '../../gateway/interface/IWebPushGateway';

// usecase層はgatewayに直接依存できない（レイヤー境界）ため、`WebPushDispatchCache`を
// このrepository層インターフェースからre-exportし、usecase側は本ファイル経由で参照する。
export type { WebPushDispatchCache };

/**
 * Web Push 送信リポジトリのインターフェース定義。
 * @remarks
 * WebPushGateway（VAPID署名・RFC8291暗号化・Push Serviceへの実HTTP通信）へ委譲する
 * 薄いアダプタ。usecase が gateway を直接注入しないための層境界を提供する
 * （coding-conventions.md のレイヤー依存順序）。
 */
export interface IWebPushSendRepository {
    /**
     * 購読先へ通知を1件送信する。
     * @param subscription - 送信先の購読（endpoint / 暗号鍵）
     * @param payload - 通知内容
     * @param dispatchCache - 同一dispatch呼び出し内でVAPID鍵インポートを
     * 使い回すためのキャッシュ識別子（省略可。PERF-104。`WebPushDispatchCache`は
     * `object`のみを要求する不透明な型のため、usecase層はgatewayの実装詳細
     * （鍵の中身）を知る必要がない）
     * @returns 送信結果
     */
    send: (
        subscription: WebPushSubscriptionKeys,
        payload: WebPushPayload,
        dispatchCache?: WebPushDispatchCache,
    ) => Promise<WebPushSendResult>;
}
