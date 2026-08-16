import type { RaceId } from '@race-schedule/core';

/** push_notification_request テーブルへの upsert に必要な項目。 */
export interface PushRequestRecord {
    id: string;
    subscriptionId: string;
    raceId: RaceId;
    fireAtMs: number;
    title: string;
    body: string;
    url?: string;
}

/**
 * 発火時刻が到来した予約1件（ディスパッチ対象）。
 * @remarks push_notification_request と push_subscription を結合して取得する
 * （送信に必要な購読の宛先・暗号鍵を含む）。
 */
export interface DuePushRequestRecord {
    id: string;
    subscriptionId: string;
    /**
     * QNTF-02: Service Worker が通知の `tag`（同一レースの重複通知の集約）に
     * 使う。ドメイン検証済みの `RaceId` ではなく DB カラムの生値（`string`）
     * のまま持ち回る（送信ペイロードに文字列として載せるだけで、ドメイン
     * ロジックでの利用は無いため）。
     */
    raceId: string;
    fireAtMs: number;
    title: string;
    body: string;
    url?: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

/**
 * Web Push 発火予約（購読 × レース）リポジトリのインターフェース定義。
 */
export interface IPushRequestRepository {
    /**
     * 予約を登録する（既に存在する場合は内容を更新し、未送信状態に戻す）。
     * @remarks 同一レースへの再呼び出しは既存のスケジュールを上書きする冪等操作
     * （INotificationScheduler の契約、web-push-design.md §1）。
     * @param record - 保存する予約情報（id は subscriptionId と raceId から導出）
     */
    upsert: (record: PushRequestRecord) => Promise<void>;

    /**
     * 予約を1件取り消す。
     * @param id - 削除対象の予約 ID
     */
    remove: (id: string) => Promise<void>;

    /**
     * 指定した購読に紐づく予約をすべて削除する。
     * @remarks D1/SQLite は外部キーのカスケード削除を強制しないため、
     * 購読削除時にアプリコードから明示的に呼ぶ（web-push-design.md §3）。
     * @param subscriptionId - 削除対象の購読 ID
     */
    removeBySubscriptionId: (subscriptionId: string) => Promise<void>;

    /**
     * 未送信かつ発火時刻が到来した予約をアトミックに確保（クレーム）したうえで、
     * 購読の宛先情報と結合して取得する。
     * @remarks CONC-01: クレームは `sentAt` を即座に設定する compare-and-swap
     * （`sentAt IS NULL` を条件に含む UPDATE）で行うため、cron の毎分実行と
     * `POST /push/dispatch` の手動実行が同時に走っても同一予約が二重に取得
     * されることはない。送信に失敗した場合は `releaseClaim` でクレームを解除し、
     * 次回のディスパッチで再試行できるようにすること。
     * @param nowMs - 現在時刻（UTC epoch millis）
     * @param limit - 最大取得件数
     * @returns 発火時刻の昇順に並んだ、確保に成功した期限到来分の予約
     */
    fetchDue: (nowMs: number, limit: number) => Promise<DuePushRequestRecord[]>;

    /**
     * 予約を送信済みにする（sent_at を現在時刻に更新）。
     * @param id - 対象の予約 ID
     */
    markSent: (id: string) => Promise<void>;

    /**
     * 複数件の予約を一括で送信済みにする（CFDATA-06、`markSent` のバッチ版）。
     * @remarks `dispatchDue` のチャンク単位（並列送信数分）でまとめて呼び出し、
     * 1件ずつのUPDATEによるD1往復を1回にまとめる。
     * @param ids - 対象の予約 ID 一覧（空配列の場合は何もしない）
     */
    markSentBatch: (ids: string[]) => Promise<void>;

    /**
     * fetchDue で確保（クレーム）した予約のクレームを解除する（sent_at を null に戻す）。
     * @remarks CONC-01: 送信に失敗した予約をクレームしたまま放置すると、
     * 二度と再試行されなくなってしまうため、失敗時に呼び出して未送信状態へ戻す。
     * @param id - 対象の予約 ID
     */
    releaseClaim: (id: string) => Promise<void>;

    /**
     * 複数件の予約を一括でクレーム解除する（CFDATA-06、`releaseClaim` のバッチ版）。
     * @param ids - 対象の予約 ID 一覧（空配列の場合は何もしない）
     */
    releaseClaimBatch: (ids: string[]) => Promise<void>;

    /**
     * 指定時刻より前の発火時刻を持つ予約をまとめて削除する（送信済み・期限切れ双方）。
     * @param beforeMs - この時刻（UTC epoch millis）より前の fire_at_ms を持つ予約を削除
     */
    purgeOld: (beforeMs: number) => Promise<void>;
}
