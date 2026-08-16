import {
    appLogger,
    DI_TOKENS,
    LogAllMethods,
    type RaceId,
    timingSafeEqualString,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IPushRequestRepository } from '../../repository/interface/IPushRequestRepository';
import type { IPushSubscriptionRepository } from '../../repository/interface/IPushSubscriptionRepository';
import type {
    IWebPushSendRepository,
    WebPushDispatchCache,
} from '../../repository/interface/IWebPushSendRepository';
import {
    buildPushRequestId,
    generateSubscriptionSecret,
    hashSubscriptionEndpoint,
    hashSubscriptionSecret,
} from '../../utility/pushIds';
import type {
    IPushUsecase,
    PushDispatchResult,
    PushRequestUpsertParams,
    PushSubscriptionUpsertParams,
    PushSubscriptionUpsertResult,
    PushTestSendResult,
} from '../interface/IPushUsecase';

/** 1回のディスパッチで処理する最大件数（毎分実行が前提のため小さめに抑える） */
const DISPATCH_BATCH_LIMIT = 100;

// PERF-054: dispatchDueが最大100件を直列処理しており、毎分cronの間隔内に
// 処理しきれないリスクがあったため、チャンク単位で並列送信に変更する。
// CONC-07: 当初はPromise.allを採用していたが、チャンク内1件が例外を投げると
// Promise.allが即rejectし、同じチャンク内で並行実行中の他の送信（既にmarkSent
// 呼び出しまで進んでいるかもしれない処理）の完了を待たずに後続チャンクの処理と
// purgeOldの呼び出しが丸ごとスキップされてしまう問題があった（Cloudflare Workers
// では待機されなかった非同期処理が実行環境の終了に伴い打ち切られうる）。
// Promise.allSettledに変更し、1件の例外が他の件・後続チャンクへ波及しないようにする。
/** 1チャンクあたりの同時送信数 */
const DISPATCH_CONCURRENCY = 10;

/** 発火時刻からこの期間を過ぎた予約は、送信済み・未送信を問わずパージ対象にする */
const OLD_REQUEST_RETENTION_MS = 24 * 60 * 60 * 1000;

// OBS-024: VAPID鍵ローテーション後の古いendpoint等、恒久的に失敗し続ける購読が
// 上限なくリトライされ検知されない問題への対応。連続失敗回数がこの値に達したら
// 購読ごと削除し、無限リトライを止める（'gone'と同じ扱いで購読を除去する）。
/** この回数だけ連続で送信に失敗した購読は削除する */
const MAX_CONSECUTIVE_FAILURES = 5;

/** テスト通知（配信テスト機能）で送信する固定タイトル・本文 */
const TEST_NOTIFICATION_PAYLOAD = {
    title: 'テスト通知',
    body: 'この通知が届いていれば、通知の受信設定は正しく機能しています。',
};

/** 購読が失効している場合にユーザーへ提示するメッセージ */
const SUBSCRIPTION_GONE_MESSAGE =
    '購読が失効しています。設定画面で通知を一度オフにしてから再度オンにしてください。';

// SEC-053: ponytail — 「未使用」を判定する経過日数の閾値。季節性のある
// 競技（開催のない時期がある）を考慮し、失効判定（MAX_CONSECUTIVE_FAILURES）
// より大幅に長い1年に設定する。実際の利用実態を見て短縮/延長を検討する余地あり。
/** この日数以上 updated_at が更新されていない購読は未使用とみなし削除する */
const STALE_SUBSCRIPTION_RETENTION_DAYS = 365;

/** dispatchDue が扱う予約1件分の型（fetchDue の戻り値要素）。 */
type DuePushRequest = Awaited<
    ReturnType<IPushRequestRepository['fetchDue']>
>[number];

/**
 * 1件の送信結果（DB更新前の中間表現）。CFDATA-06: チャンク単位でまとめて
 * DBへ反映するため、送信（sendOne）とDB更新（applyChunkOutcomes）を分離する。
 */
interface SendAttempt {
    request: DuePushRequest;
    outcome: 'sent' | 'gone' | 'failed';
    /** outcome==='failed' の場合のみ、警告ログ用の送信失敗メッセージ */
    message?: string;
}

/**
 * 連続失敗回数が上限（[MAX_CONSECUTIVE_FAILURES]）に達しているかを判定する。
 * @param failureCount - incrementFailureCount の戻り値（購読が既に存在しない
 * 場合は undefined）
 */
const hasExceededFailureLimit = (failureCount: number | undefined): boolean =>
    failureCount !== undefined && failureCount >= MAX_CONSECUTIVE_FAILURES;

/**
 * 購読の所有権シークレットが発行済みかどうかを判定する
 * （未発行 = 新規行=undefined、既存行だが未発行=null のいずれか、
 * push-ownership-design.md §2.4）。
 * @param secretHash - findSecretHashById の戻り値
 */
const isSecretIssued = (
    secretHash: string | null | undefined,
): secretHash is string => secretHash !== undefined && secretHash !== null;

/**
 * Web Push（購読・発火予約）に関する業務ロジック（Usecase）。
 */
@LogAllMethods
@injectable()
export class PushUsecase implements IPushUsecase {
    public constructor(
        @inject(DI_TOKENS.PushSubscriptionRepository)
        private readonly subscriptionRepository: IPushSubscriptionRepository,
        @inject(DI_TOKENS.PushRequestRepository)
        private readonly requestRepository: IPushRequestRepository,
        @inject(DI_TOKENS.WebPushSendRepository)
        private readonly webPushSendRepository: IWebPushSendRepository,
    ) {}

    /**
     * 失効した購読（404/410）を、紐づく予約ごと削除する
     * （web-push-design.md §4）。
     * @param subscriptionId - 失効した購読の ID
     */
    private async removeGoneSubscription(
        subscriptionId: string,
    ): Promise<void> {
        await this.subscriptionRepository.removeWithDependentRequests(
            subscriptionId,
        );
    }

    /**
     * 新しい所有権シークレットを発行し、購読を保存する
     * （新規行、または既存行にシークレット未発行の場合）。
     * @param id - 購読ID
     * @param params - endpoint・暗号鍵
     * @returns 発行したシークレットを含む登録結果
     */
    private async issueNewSubscriptionSecret(
        id: string,
        params: PushSubscriptionUpsertParams,
    ): Promise<PushSubscriptionUpsertResult> {
        const secret = generateSubscriptionSecret();
        const secretHash = await hashSubscriptionSecret(secret);
        await this.subscriptionRepository.upsert({
            id,
            endpoint: params.endpoint,
            p256dh: params.p256dh,
            auth: params.auth,
            secretHash,
        });
        return { ok: true, id, secret };
    }

    /**
     * 既に発行済みのシークレットを提示値と照合し、一致すれば購読情報のみ更新する
     * （secret_hash 自体は変更しない）。
     * @param id - 購読ID
     * @param params - endpoint・暗号鍵・提示されたシークレット
     * @param existingSecretHash - DBに保存済みのシークレットハッシュ
     * @returns 検証結果に応じた登録結果（シークレットは含めない）
     */
    private async verifyAndUpdateSubscription(
        id: string,
        params: PushSubscriptionUpsertParams,
        existingSecretHash: string,
    ): Promise<PushSubscriptionUpsertResult> {
        if (!params.secret) return { ok: false };

        const presentedHash = await hashSubscriptionSecret(params.secret);
        const isValid = await timingSafeEqualString(
            presentedHash,
            existingSecretHash,
        );
        if (!isValid) return { ok: false };

        await this.subscriptionRepository.upsert({
            id,
            endpoint: params.endpoint,
            p256dh: params.p256dh,
            auth: params.auth,
        });
        return { ok: true, id };
    }

    public async upsertSubscription(
        params: PushSubscriptionUpsertParams,
    ): Promise<PushSubscriptionUpsertResult> {
        const id = await hashSubscriptionEndpoint(params.endpoint);
        const existingSecretHash =
            await this.subscriptionRepository.findSecretHashById(id);

        // 新規行、または既存行にシークレット未発行の場合は新規発行する
        // （push-ownership-design.md §2.4）。
        if (!isSecretIssued(existingSecretHash)) {
            return this.issueNewSubscriptionSecret(id, params);
        }

        return this.verifyAndUpdateSubscription(id, params, existingSecretHash);
    }

    public async removeSubscription(endpoint: string): Promise<void> {
        const id = await hashSubscriptionEndpoint(endpoint);
        // CONC-08: 購読削除と紐づく予約削除をD1バッチでまとめて行う
        // （subscriptionRepository.removeWithDependentRequests参照）。
        await this.subscriptionRepository.removeWithDependentRequests(id);
    }

    public async upsertRequest(params: PushRequestUpsertParams): Promise<void> {
        const id = buildPushRequestId(params.subscriptionId, params.raceId);
        await this.requestRepository.upsert({ id, ...params });
    }

    public async removeRequest(
        subscriptionId: string,
        raceId: RaceId,
    ): Promise<void> {
        const id = buildPushRequestId(subscriptionId, raceId);
        await this.requestRepository.remove(id);
    }

    /**
     * 1件の予約を送信し、送信結果を返す（dispatchDueのチャンク並列処理用）。
     * @remarks CFDATA-06: ここではDBへの書き込みは行わない。チャンク内の
     * 全件の送信が完了してから {@link applyChunkOutcomes} でまとめて
     * 反映することで、1件ずつのUPDATEによるD1往復を減らす。
     * @param request - 送信対象の予約レコード
     * @param dispatchCache - 同一dispatch呼び出し内でVAPID鍵インポートを
     * 使い回すためのキャッシュ識別子（PERF-104）
     * @returns この1件の送信結果
     */
    private async sendOne(
        request: DuePushRequest,
        dispatchCache: WebPushDispatchCache,
    ): Promise<SendAttempt> {
        const result = await this.webPushSendRepository.send(
            {
                endpoint: request.endpoint,
                p256dh: request.p256dh,
                auth: request.auth,
            },
            {
                title: request.title,
                body: request.body,
                url: request.url,
                raceId: request.raceId,
            },
            dispatchCache,
        );

        if (result.ok) return { request, outcome: 'sent' };
        if (result.gone) return { request, outcome: 'gone' };
        return { request, outcome: 'failed', message: result.message };
    }

    /**
     * sendOne の settlement を SendAttempt へ変換する。
     * @remarks
     * CONC-07: rejected（sendOne自体が例外を投げた想定外のケース）は失敗として
     * 扱いつつ、Promise.allSettledにより他の件・後続チャンクの処理は継続する。
     * @param settlement - Promise.allSettled が返す1件分の結果
     * @param request - settlement に対応する予約レコード（rejected 時は
     * settlement 自体に値が無いため、呼び出し元がインデックスで対応付ける）
     */
    private classifySendSettlement(
        settlement: PromiseSettledResult<SendAttempt>,
        request: DuePushRequest,
    ): SendAttempt {
        if (settlement.status === 'rejected') {
            appLogger.warn(
                'unexpected error while dispatching web push notification',
                settlement.reason,
            );
            return {
                request,
                outcome: 'failed',
                message: String(settlement.reason),
            };
        }
        return settlement.value;
    }

    /**
     * 送信成功群をまとめてDBへ反映する（markSent + 連続失敗回数リセット）。
     * @param attempts - 送信成功した予約一覧
     */
    private async applySentOutcomes(attempts: SendAttempt[]): Promise<void> {
        if (attempts.length === 0) return;
        // OBS-024: 送信成功で連続失敗回数をリセットする。
        await Promise.all([
            this.requestRepository.markSentBatch(
                attempts.map((attempt) => attempt.request.id),
            ),
            this.subscriptionRepository.resetFailureCountBatch([
                ...new Set(
                    attempts.map((attempt) => attempt.request.subscriptionId),
                ),
            ]),
        ]);
    }

    /**
     * 送信時点で判明した失効（404/410）群をまとめて削除する。
     * @param attempts - 失効が判明した予約一覧
     */
    private async applyGoneOutcomes(attempts: SendAttempt[]): Promise<void> {
        if (attempts.length === 0) return;
        await this.subscriptionRepository.removeWithDependentRequestsBatch([
            ...new Set(
                attempts.map((attempt) => attempt.request.subscriptionId),
            ),
        ]);
    }

    /**
     * 送信失敗群を、連続失敗回数が上限に達した（購読ごと削除する）ものと、
     * 再試行対象（クレーム解除する）のものに振り分ける。
     * @param attempts - 送信に失敗した予約一覧
     * @param failureCounts - incrementFailureCountBatch の戻り値
     */
    private partitionFailedOutcomes(
        attempts: SendAttempt[],
        failureCounts: Map<string, number>,
    ): { exceeded: SendAttempt[]; retry: SendAttempt[] } {
        const exceeded: SendAttempt[] = [];
        const retry: SendAttempt[] = [];
        for (const attempt of attempts) {
            const failureCount = failureCounts.get(
                attempt.request.subscriptionId,
            );
            (hasExceededFailureLimit(failureCount) ? exceeded : retry).push(
                attempt,
            );
        }
        return { exceeded, retry };
    }

    /**
     * 上限到達分は購読ごと削除し、再試行対象はクレームを解除する。
     * @param exceeded - 連続失敗回数が上限に達した予約一覧
     * @param retry - 再試行対象の予約一覧
     */
    private async persistFailedOutcomes(
        exceeded: SendAttempt[],
        retry: SendAttempt[],
    ): Promise<void> {
        await Promise.all([
            exceeded.length === 0
                ? undefined
                : this.subscriptionRepository.removeWithDependentRequestsBatch([
                      ...new Set(
                          exceeded.map(
                              (attempt) => attempt.request.subscriptionId,
                          ),
                      ),
                  ]),
            // CONC-01: fetchDueのクレームで既にsentAtが設定されているため、
            // ここでクレームを解除（sentAtをnullへ戻す）しないと次回以降再試行されない。
            retry.length === 0
                ? undefined
                : this.requestRepository.releaseClaimBatch(
                      retry.map((attempt) => attempt.request.id),
                  ),
        ]);
    }

    /**
     * 送信失敗の内訳をwarnログに出す（OBS-024）。
     * @param exceeded - 連続失敗回数が上限に達した予約一覧
     * @param retry - 再試行対象の予約一覧
     * @param failureCounts - incrementFailureCountBatch の戻り値
     */
    private logFailedOutcomes(
        exceeded: SendAttempt[],
        retry: SendAttempt[],
        failureCounts: Map<string, number>,
    ): void {
        for (const attempt of exceeded) {
            appLogger.warn('permanently failing web push subscription purged', {
                subscriptionId: attempt.request.subscriptionId,
                failureCount: failureCounts.get(attempt.request.subscriptionId),
                message: attempt.message,
            });
        }
        for (const attempt of retry) {
            appLogger.warn('failed to send web push notification', {
                requestId: attempt.request.id,
                failureCount: failureCounts.get(attempt.request.subscriptionId),
                message: attempt.message,
            });
        }
    }

    /**
     * 送信失敗群の連続失敗回数をまとめてインクリメントし、上限到達分は
     * 購読ごと削除、それ以外はクレームを解除して次回再試行させる（OBS-024）。
     * @param attempts - 送信に失敗した予約一覧
     * @returns 上限到達により購読ごと削除した件数（呼び出し元の gone 集計に
     * 合算するため）
     */
    private async applyFailedOutcomes(
        attempts: SendAttempt[],
    ): Promise<number> {
        if (attempts.length === 0) return 0;

        const failureCounts =
            await this.subscriptionRepository.incrementFailureCountBatch([
                ...new Set(
                    attempts.map((attempt) => attempt.request.subscriptionId),
                ),
            ]);
        const { exceeded, retry } = this.partitionFailedOutcomes(
            attempts,
            failureCounts,
        );
        await this.persistFailedOutcomes(exceeded, retry);
        this.logFailedOutcomes(exceeded, retry, failureCounts);

        return exceeded.length;
    }

    /**
     * 1チャンク分の送信結果を種別ごとにまとめてDBへ反映する（CFDATA-06）。
     * @param attempts - このチャンクの送信結果一覧
     * @returns 結果種別ごとの件数
     */
    private async applyChunkOutcomes(
        attempts: SendAttempt[],
    ): Promise<{ sent: number; gone: number; failed: number }> {
        const sentAttempts = attempts.filter((a) => a.outcome === 'sent');
        const goneAttempts = attempts.filter((a) => a.outcome === 'gone');
        const failedAttempts = attempts.filter((a) => a.outcome === 'failed');

        const [, , exceededCount] = await Promise.all([
            this.applySentOutcomes(sentAttempts),
            this.applyGoneOutcomes(goneAttempts),
            this.applyFailedOutcomes(failedAttempts),
        ]);

        return {
            sent: sentAttempts.length,
            gone: goneAttempts.length + exceededCount,
            failed: failedAttempts.length - exceededCount,
        };
    }

    /**
     * 対象リクエストをチャンク単位で並列ディスパッチし、結果種別ごとの件数を集計する。
     * @param dueRequests - 送信対象の予約レコード一覧
     * @returns 結果種別ごとの件数
     */
    private async dispatchAllInChunks(
        dueRequests: DuePushRequest[],
    ): Promise<{ sent: number; gone: number; failed: number }> {
        // PERF-104: この1回のdispatchDue呼び出し内で送信するすべての
        // sendOneに同じ識別子を渡し、VAPID秘密鍵のCryptoKeyインポートを
        // 使い回す（gateway/utility/webPushCrypto.tsのWeakMapキャッシュ参照）。
        const dispatchCache: WebPushDispatchCache = {};

        let sent = 0;
        let gone = 0;
        let failed = 0;
        for (
            let index = 0;
            index < dueRequests.length;
            index += DISPATCH_CONCURRENCY
        ) {
            const chunk = dueRequests.slice(
                index,
                index + DISPATCH_CONCURRENCY,
            );
            const settlements = await Promise.allSettled(
                chunk.map((request) => this.sendOne(request, dispatchCache)),
            );
            const attempts = settlements.map((settlement, i) =>
                this.classifySendSettlement(settlement, chunk[i]),
            );
            // CFDATA-06: 1件ずつDB更新するのではなく、チャンク内の送信が
            // 全て完了してからまとめて反映する（成功群・失敗群・失効群を
            // それぞれバッチ化したUPDATE/DELETEにまとめ、D1往復回数を抑える）。
            const chunkResult = await this.applyChunkOutcomes(attempts);
            sent += chunkResult.sent;
            gone += chunkResult.gone;
            failed += chunkResult.failed;
        }
        return { sent, gone, failed };
    }

    /**
     * ディスパッチ全体で1件以上失敗していれば、error レベルでサマリーを
     * ログ出力する（OBS-009）。個々の送信失敗は既に handleDispatchResult で
     * warn ログ済みだが、それだけでは「今回のディスパッチ全体でどれだけ
     * 失敗したか」というトレンドに誰も気づけないため、Workers Logs
     * （OBS-001のJSON構造化ログ）で level:error による監視・集計ができるよう
     * 別途まとめて記録する。
     * @param result - `dispatchDue` の集計結果
     */
    private logDispatchFailuresIfAny(result: PushDispatchResult): void {
        if (result.failed > 0) {
            appLogger.error('Web Push dispatch had failures', result);
        }
    }

    public async dispatchDue(nowMs: number): Promise<PushDispatchResult> {
        const dueRequests = await this.requestRepository.fetchDue(
            nowMs,
            DISPATCH_BATCH_LIMIT,
        );

        const { sent, gone, failed } =
            await this.dispatchAllInChunks(dueRequests);

        await this.requestRepository.purgeOld(nowMs - OLD_REQUEST_RETENTION_MS);

        const result = { attempted: dueRequests.length, sent, gone, failed };
        this.logDispatchFailuresIfAny(result);
        return result;
    }

    public async sendTest(subscriptionId: string): Promise<PushTestSendResult> {
        const subscription =
            await this.subscriptionRepository.findById(subscriptionId);
        if (!subscription) {
            return { ok: false, message: '購読が見つかりません' };
        }

        const result = await this.webPushSendRepository.send(
            subscription,
            TEST_NOTIFICATION_PAYLOAD,
        );
        if (result.ok) {
            return { ok: true };
        }
        if (result.gone) {
            await this.removeGoneSubscription(subscriptionId);
            return { ok: false, message: SUBSCRIPTION_GONE_MESSAGE };
        }
        return { ok: false, message: result.message };
    }

    public async purgeStaleSubscriptions(): Promise<number> {
        const purged = await this.subscriptionRepository.purgeStale(
            STALE_SUBSCRIPTION_RETENTION_DAYS,
        );
        if (purged > 0) {
            appLogger.info('purged stale web push subscriptions', { purged });
        }
        return purged;
    }
}
