import type { RaceId } from '@race-schedule/core';

/** 購読の登録（upsert）に必要な項目。 */
export interface PushSubscriptionUpsertParams {
    endpoint: string;
    p256dh: string;
    auth: string;
    /**
     * 所有権シークレット（`X-Push-Subscription-Secret` ヘッダー由来、
     * push-ownership-design.md §2.2）。既存購読に発行済みシークレットが
     * ある場合のみ検証に使う。未提示は `undefined`。
     */
    secret?: string;
}

/**
 * 購読登録（upsertSubscription）の結果。
 * @remarks
 * `secret` は新規発行時（既存行が無い、または既存行にシークレット未発行の場合）
 * のみ含まれる。既存の発行済みシークレットで検証に成功した更新では、平文の
 * 再送を避けるため `secret` を含めない（push-ownership-design.md §2.4）。
 */
export type PushSubscriptionUpsertResult =
    | { ok: true; id: string; secret?: string }
    | {
          /** 既存行にシークレットが発行済みで、提示値が不一致・未提示だった */
          ok: false;
      };

/** 発火予約の登録（upsert）に必要な項目。 */
export interface PushRequestUpsertParams {
    subscriptionId: string;
    raceId: RaceId;
    fireAtMs: number;
    title: string;
    body: string;
    url?: string;
}

/** テスト通知の即時送信結果。 */
export interface PushTestSendResult {
    /** 送信に成功したかどうか */
    ok: boolean;
    /** 失敗時の理由（購読未登録・失効・送信エラーなど） */
    message?: string;
}

/** ディスパッチ（期限到来分の配信）の結果サマリー。 */
export interface PushDispatchResult {
    /** 今回のディスパッチ対象として取得した件数 */
    attempted: number;
    /** 送信に成功した件数 */
    sent: number;
    /** 購読が失効しており（404/410）、購読ごと削除した件数 */
    gone: number;
    /** 送信に失敗した件数（次回のディスパッチで再試行される） */
    failed: number;
}

/**
 * Web Push（購読・発火予約）に関する業務ロジック（Usecase）のインターフェース定義。
 * @remarks
 * サーバはお気に入り／重賞ロジックを再実装しない。クライアントが登録した予約
 * （本文込み）を、期限到来時にそのまま配信するだけの単純なディスパッチャに徹する
 * （web-push-design.md §1）。
 */
export interface IPushUsecase {
    /**
     * 購読を登録する（既に存在する場合は更新）。
     * @remarks
     * 所有権シークレットの発行・検証（push-ownership-design.md §2.4、SECPUSH-02）:
     * 新規行、または既存行にシークレット未発行の場合は新しいシークレットを発行し
     * 結果に含める。既存行にシークレットが発行済みの場合は `params.secret` を
     * 検証し、不一致・未提示なら `{ ok: false }` を返す（DBへの書き込みは行わない）。
     * @param params - endpoint・暗号鍵（p256dh/auth）・所有権シークレット（省略可）
     * @returns 登録結果（導出された購読IDと、新規発行時のみシークレット）
     */
    upsertSubscription: (
        params: PushSubscriptionUpsertParams,
    ) => Promise<PushSubscriptionUpsertResult>;

    /**
     * 購読を解除する。紐づく発火予約もあわせて削除する。
     * @param endpoint - 解除対象の購読の endpoint
     */
    removeSubscription: (endpoint: string) => Promise<void>;

    /**
     * 発火予約を登録する（既に存在する場合は上書き、冪等）。
     * @param params - 購読ID・レースID・発火時刻（UTC epoch millis）・通知本文
     */
    upsertRequest: (params: PushRequestUpsertParams) => Promise<void>;

    /**
     * 発火予約を取り消す。
     * @param subscriptionId - 購読ID
     * @param raceId - レースID
     */
    removeRequest: (subscriptionId: string, raceId: RaceId) => Promise<void>;

    /**
     * 未送信かつ発火時刻が到来した予約を配信する。
     * @remarks
     * 送信成功で `sent_at` を更新、購読の失効（404/410）で購読ごと削除、
     * それ以外の失敗はログのみに留め次回のディスパッチで再試行させる
     * （web-push-design.md §4）。あわせて古い予約をパージする。
     * @param nowMs - 現在時刻（UTC epoch millis）
     * @returns ディスパッチ結果のサマリー
     */
    dispatchDue: (nowMs: number) => Promise<PushDispatchResult>;

    /**
     * 指定した購読へテスト通知を即時送信する（配信テスト機能）。
     * @remarks
     * 発火予約を経由せず、購読へ直接送信する。購読が失効している（404/410）
     * 場合は dispatchDue 同様に購読ごと削除する。
     * @param subscriptionId - 送信先の購読 ID
     * @returns 送信結果
     */
    sendTest: (subscriptionId: string) => Promise<PushTestSendResult>;

    /**
     * 長期間更新の無い（＝未使用の）購読を、紐づく発火予約ごと削除する
     * （SEC-053、データ最小化）。
     * @remarks 失効・連続送信失敗による削除（`dispatchDue`）とは別軸のパージ。
     * @returns 削除した購読件数
     */
    purgeStaleSubscriptions: () => Promise<number>;
}
