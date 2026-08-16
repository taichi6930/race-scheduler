import { z } from 'zod';

/**
 * {@link FailureDetail}（`utilities/upsertResult.ts`）に対応するZodスキーマ
 */
export const failureDetailSchema = z.object({
    db: z.string(),
    id: z.string(),
    reason: z.string(),
});

/**
 * {@link UpsertResult}（`utilities/upsertResult.ts`）に対応するZodスキーマ。
 * batch の client 層が API レスポンスを検証する際に使用する。
 */
export const upsertResultSchema = z.object({
    successCount: z.number(),
    failureCount: z.number(),
    failures: z.array(failureDetailSchema),
});

/** {@link CalendarUpsertResult} の `failures` 要素に対応するZodスキーマ */
const calendarUpsertFailureSchema = z.object({
    id: z.string(),
    reason: z.string(),
});

/**
 * {@link CalendarUpsertResult}（`dto/calendarUpsertResult.ts`）に対応するZodスキーマ
 */
export const calendarUpsertResultSchema = z.object({
    successCount: z.number(),
    insertedCount: z.number(),
    updatedCount: z.number(),
    deletedCount: z.number(),
    failureCount: z.number(),
    failures: z.array(calendarUpsertFailureSchema),
});
