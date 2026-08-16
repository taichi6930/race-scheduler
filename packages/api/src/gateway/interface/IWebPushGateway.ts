/** Push Service への送信に必要な購読の宛先・暗号鍵。 */
export interface WebPushSubscriptionKeys {
    endpoint: string;
    p256dh: string;
    auth: string;
}

/** 通知ペイロード（登録時にクライアントが確定した内容）。 */
export interface WebPushPayload {
    title: string;
    body: string;
    url?: string;
    /**
     * QNTF-02: Service Worker（`packages/front/web/push-sw.js`）が
     * `showNotification` の `tag` に使う値。同一レースについて複数回配信
     * された通知（自動重賞通知とお気に入り通知が同一レースに当たる場合等）を
     * 1件にまとめるために使う。
     */
    raceId?: string;
}

/**
 * 送信結果。
 * @remarks
 * `gone` は購読が失効している（Push Service が 404/410 を返した）ことを示す。
 * この場合、呼び出し元は購読とその予約を削除するのが一般的な対処
 * （web-push-design.md §4 のディスパッチ疑似コード参照）。
 */
export type WebPushSendResult =
    | { ok: true }
    | { ok: false; gone: boolean; message: string };

/**
 * PERF-104: `dispatchDue` が複数件をチャンク並列送信する際、VAPID秘密鍵の
 * `CryptoKey` インポートを1回のdispatch呼び出し内で使い回すためのキャッシュ
 * 識別子。呼び出し元（usecase層）が1回のdispatchにつき1つ（`{}`で十分）
 * 生成し、以降の `send` 呼び出しに同じ参照を渡す。型は `object` のみを
 * 要求するため、usecase/repository層はgateway実装の詳細を知る必要が無い。
 */
export type WebPushDispatchCache = object;

/**
 * Web Push 送信ゲートウェイのインターフェース定義。
 * VAPID（RFC 8292）署名と RFC 8291（aes128gcm）ペイロード暗号化を行い、
 * Push Service へ配信する。
 */
export interface IWebPushGateway {
    /**
     * 購読先へ通知を1件送信する。
     * @param subscription - 送信先の購読（endpoint / 暗号鍵）
     * @param payload - 通知内容
     * @param dispatchCache - 同一dispatch呼び出し内でVAPID鍵インポートを
     * 使い回すためのキャッシュ識別子（省略可。PERF-104）
     * @returns 送信結果
     */
    send: (
        subscription: WebPushSubscriptionKeys,
        payload: WebPushPayload,
        dispatchCache?: WebPushDispatchCache,
    ) => Promise<WebPushSendResult>;
}
