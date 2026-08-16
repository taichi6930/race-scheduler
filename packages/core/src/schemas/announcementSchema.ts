import { z } from 'zod';

/**
 * Server-Driven UI PoC: 起動時お知らせバナー用のUIスキーマ。
 * front はこのスキーマの形をそのまま解釈して描画する（front再ビルドなしで
 * message/enabled を変更できることがこのエンドポイントの狙い）。
 * `schemaVersion` は将来スキーマを拡張する際、frontの解釈可否を判定するために
 * 予約している（現時点ではv1のみ）。
 */
export const announcementSchema = z.object({
    schemaVersion: z.literal(1),
    enabled: z.boolean(),
    message: z.string().min(1),
    actionLabel: z.string().min(1).optional(),
    actionUrl: z.string().url().optional(),
});

/** {@link announcementSchema} の推論型 */
export type Announcement = z.infer<typeof announcementSchema>;
