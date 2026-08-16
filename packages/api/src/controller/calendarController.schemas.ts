import { z } from 'zod';

/**
 * 指定レース フラグ追加リクエストのスキーマ
 */
export const CalendarFlagAddRequestSchema = z.object({
    raceId: z.string(),
    label: z
        .string()
        .max(200, 'labelは200文字以下である必要があります')
        .optional(),
});

/**
 * 指定レース フラグ削除リクエストのスキーマ
 */
export const CalendarFlagRemoveRequestSchema = z.object({
    raceId: z.string(),
});
