import { z } from 'zod';

/**
 * Web Push 購読の登録（upsert）リクエストのスキーマ。
 * @remarks PushSubscription（ブラウザの pushManager.subscribe() の戻り値）を JSON 化した形。
 */
export const PushSubscriptionUpsertRequestSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
    }),
});

/**
 * Web Push 購読の解除リクエストのスキーマ。
 */
export const PushSubscriptionDeleteRequestSchema = z.object({
    endpoint: z.string().url(),
});

/**
 * 発火予約の登録（upsert）リクエストのスキーマ。
 * @remarks 通知本文（title/body）はサーバでレース情報を再構築しない設計のため、
 * クライアントが登録時に確定させて一緒に送る（web-push-design.md §1）。
 */
/**
 * fireAtMs（発火予約日時）の上限値。2100-01-01T00:00:00Z のエポックミリ秒。
 * @remarks 無制限な未来日時の登録を防ぐための妥当な上限として固定値を採用する。
 */
const MAX_FIRE_AT_MS = 4_102_444_800_000;

export const PushRequestUpsertRequestSchema = z.object({
    subscriptionId: z.string().min(1),
    raceId: z.string(),
    fireAtMs: z
        .number()
        .int()
        .positive()
        .max(MAX_FIRE_AT_MS, '発火予約日時が上限を超えています'),
    title: z.string().min(1).max(200, 'titleは200文字以下である必要があります'),
    body: z.string().min(1).max(1000, 'bodyは1000文字以下である必要があります'),
    url: z.string().optional(),
});

/**
 * 発火予約の取消リクエストのスキーマ。
 */
export const PushRequestDeleteRequestSchema = z.object({
    subscriptionId: z.string().min(1),
    raceId: z.string(),
});

/**
 * テスト通知の即時送信リクエストのスキーマ（配信テスト機能）。
 */
export const PushTestSendRequestSchema = z.object({
    subscriptionId: z.string().min(1),
});
