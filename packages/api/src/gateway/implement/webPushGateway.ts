import { LogAllMethods, toErrorMessage } from '@race-schedule/core';
import { injectable } from 'tsyringe';

import type {
    IWebPushGateway,
    WebPushDispatchCache,
    WebPushPayload,
    WebPushSendResult,
    WebPushSubscriptionKeys,
} from '../interface/IWebPushGateway';
import { postPushRequest } from '../utility/webPushCrypto';

/**
 * Web Push（VAPID署名 + RFC 8291 暗号化）を用いて Push Service へ通知を送信するゲートウェイ。
 * Cloudflare Workers の Web Crypto API のみで実装し、外部ライブラリに依存しない。
 */
@LogAllMethods
@injectable()
export class WebPushGateway implements IWebPushGateway {
    public async send(
        subscription: WebPushSubscriptionKeys,
        payload: WebPushPayload,
        dispatchCache?: WebPushDispatchCache,
    ): Promise<WebPushSendResult> {
        try {
            return await postPushRequest(subscription, payload, dispatchCache);
        } catch (error) {
            return { ok: false, gone: false, message: toErrorMessage(error) };
        }
    }
}
