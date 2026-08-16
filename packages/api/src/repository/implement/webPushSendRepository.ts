import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type {
    IWebPushGateway,
    WebPushDispatchCache,
    WebPushPayload,
    WebPushSendResult,
    WebPushSubscriptionKeys,
} from '../../gateway/interface/IWebPushGateway';
import type { IWebPushSendRepository } from '../interface/IWebPushSendRepository';

/**
 * Web Push 送信リポジトリの実装。
 * @remarks
 * WebPushGateway（HTTP通信の詳細）へ委譲する薄いアダプタ。
 * Usecase が Gateway を直接注入しないための層境界を提供する。
 */
@LogAllMethods
@injectable()
export class WebPushSendRepository implements IWebPushSendRepository {
    public constructor(
        @inject(DI_TOKENS.WebPushGateway)
        private readonly webPushGateway: IWebPushGateway,
    ) {}

    public async send(
        subscription: WebPushSubscriptionKeys,
        payload: WebPushPayload,
        dispatchCache?: WebPushDispatchCache,
    ): Promise<WebPushSendResult> {
        return this.webPushGateway.send(subscription, payload, dispatchCache);
    }
}
