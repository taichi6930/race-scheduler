import {
    badRequest,
    DI_TOKENS,
    EnvStore,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
    resolveRaceIdOrBadRequest,
    timingSafeEqualString,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IPushUsecase } from '../usecase/interface/IPushUsecase';
import {
    PushRequestDeleteRequestSchema,
    PushRequestUpsertRequestSchema,
    PushSubscriptionDeleteRequestSchema,
    PushSubscriptionUpsertRequestSchema,
    PushTestSendRequestSchema,
} from './pushController.schemas';

const PUSH_DISPATCH_TOKEN_HEADER = 'X-Push-Dispatch-Token';

// 購読の所有権シークレットを載せるヘッダー（push-ownership-design.md §2.2）。
// SECPUSH-02（P-1）時点では POST /push/subscription の発行・検証にのみ使う。
// 他4エンドポイントでの検証はSECPUSH-05（P-4）で有効化する。
const PUSH_SUBSCRIPTION_SECRET_HEADER = 'X-Push-Subscription-Secret';

/**
 * リクエストの共有シークレットトークンが、設定済みの `PUSH_DISPATCH_TOKEN` と一致するかどうかを判定する。
 * 複合条件（&&）を独立関数として切り出し、C2組み合わせ爆発を回避する。
 * 比較は `timingSafeEqualString` による定数時間比較（SEC-008）。
 * @param requestToken - リクエストヘッダーから取得したトークン
 * @param expectedToken - `PUSH_DISPATCH_TOKEN` 環境変数の値
 * @returns 両方が設定されており、値が一致すれば true
 */
async function isValidDispatchToken(
    requestToken: string | null,
    expectedToken: string | undefined,
): Promise<boolean> {
    if (!expectedToken) return false;
    if (requestToken === null) return false;
    return timingSafeEqualString(requestToken, expectedToken);
}

/**
 * Controller層：Web Push の購読・発火予約エンドポイント。
 * 外部入力（HTTPリクエスト）を Zod スキーマ・domain の RaceId 検証に通し、
 * 検証済みの値を usecase に送る。
 */
@LogAllMethods
@injectable()
export class PushController {
    public constructor(
        @inject(DI_TOKENS.PushUsecase)
        private readonly usecase: IPushUsecase,
    ) {}

    /**
     * 購読を登録する（既に存在する場合は更新）。
     * body: { endpoint: string, keys: { p256dh: string, auth: string } }
     * header: X-Push-Subscription-Secret（既存購読の更新時のみ必須。省略可）
     * @remarks
     * 新規発行時のみ応答に `secret` を含む（push-ownership-design.md §2.4）。
     * 既存購読にシークレットが発行済みで、提示値が不一致・未提示の場合は401を返す。
     * @param request HTTPリクエスト（body: 購読情報、header: 所有権シークレット）
     * @returns upsert結果を含むレスポンス
     */
    public async subscriptionUpsert(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                PushSubscriptionUpsertRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const presentedSecret = request.headers.get(
                PUSH_SUBSCRIPTION_SECRET_HEADER,
            );
            const result = await this.usecase.upsertSubscription({
                endpoint: parsedBody.value.endpoint,
                p256dh: parsedBody.value.keys.p256dh,
                auth: parsedBody.value.keys.auth,
                secret: presentedSecret ?? undefined,
            });
            if (!result.ok) return badRequest('Unauthorized', 401);
            return json({ id: result.id, secret: result.secret }, 200);
        } catch (error) {
            return handleControllerError(
                error,
                'PushController.subscriptionUpsert',
            );
        }
    }

    /**
     * 購読を解除する。紐づく発火予約もあわせて削除される。
     * body: { endpoint: string }
     * @param request HTTPリクエスト（body: endpoint）
     * @returns 削除結果を含むレスポンス
     */
    public async subscriptionRemove(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                PushSubscriptionDeleteRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            await this.usecase.removeSubscription(parsedBody.value.endpoint);
            return json({ success: true }, 200);
        } catch (error) {
            return handleControllerError(
                error,
                'PushController.subscriptionRemove',
            );
        }
    }

    /**
     * 発火予約を登録する（既に存在する場合は上書き、冪等）。
     * body: { subscriptionId, raceId, fireAtMs, title, body, url? }
     * @param request HTTPリクエスト（body: 予約情報）
     * @returns upsert結果を含むレスポンス
     */
    public async requestUpsert(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                PushRequestUpsertRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const parsedRaceId = resolveRaceIdOrBadRequest(
                parsedBody.value.raceId,
            );
            if (!parsedRaceId.ok) return parsedRaceId.response;

            await this.usecase.upsertRequest({
                subscriptionId: parsedBody.value.subscriptionId,
                raceId: parsedRaceId.value,
                fireAtMs: parsedBody.value.fireAtMs,
                title: parsedBody.value.title,
                body: parsedBody.value.body,
                url: parsedBody.value.url,
            });
            return json({ success: true }, 200);
        } catch (error) {
            return handleControllerError(error, 'PushController.requestUpsert');
        }
    }

    /**
     * 発火予約を取り消す。
     * body: { subscriptionId, raceId }
     * @param request HTTPリクエスト（body: subscriptionId, raceId）
     * @returns 削除結果を含むレスポンス
     */
    public async requestRemove(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                PushRequestDeleteRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const parsedRaceId = resolveRaceIdOrBadRequest(
                parsedBody.value.raceId,
            );
            if (!parsedRaceId.ok) return parsedRaceId.response;

            await this.usecase.removeRequest(
                parsedBody.value.subscriptionId,
                parsedRaceId.value,
            );
            return json({ success: true }, 200);
        } catch (error) {
            return handleControllerError(error, 'PushController.requestRemove');
        }
    }

    /**
     * 未送信かつ発火時刻が到来した予約を配信する。
     * `X-Push-Dispatch-Token` ヘッダーが `PUSH_DISPATCH_TOKEN` 環境変数と一致しない場合は拒否する。
     * デバッグ・手動実行用（毎分の自動配信は Cloudflare `scheduled` が行う想定）。
     * @param request HTTPリクエスト
     * @returns 配信結果を含むレスポンス
     */
    public async dispatch(request: Request): Promise<Response> {
        try {
            const requestToken = request.headers.get(
                PUSH_DISPATCH_TOKEN_HEADER,
            );
            if (
                !(await isValidDispatchToken(
                    requestToken,
                    EnvStore.env.PUSH_DISPATCH_TOKEN,
                ))
            ) {
                return badRequest('Unauthorized', 401);
            }

            const result = await this.usecase.dispatchDue(Date.now());
            return json(result, 200);
        } catch (error) {
            return handleControllerError(error, 'PushController.dispatch');
        }
    }

    /**
     * 指定した購読へテスト通知を即時送信する（配信テスト機能）。
     * body: { subscriptionId: string }
     * @param request HTTPリクエスト（body: subscriptionId）
     * @returns 送信結果を含むレスポンス
     */
    public async sendTest(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                PushTestSendRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const result = await this.usecase.sendTest(
                parsedBody.value.subscriptionId,
            );
            return json(result, 200);
        } catch (error) {
            return handleControllerError(error, 'PushController.sendTest');
        }
    }
}
