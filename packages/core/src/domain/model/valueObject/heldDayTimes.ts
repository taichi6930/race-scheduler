import { z } from 'zod';

/**
 * HeldDayTimesのzod型定義
 */
export const HeldDayTimesSchema = z
    .number()
    .int()
    .min(1, '開催日数は1以上である必要があります')
    .max(99, '開催日数は99以下である必要があります');

/**
 * HeldDayTimesの型定義
 */
export type HeldDayTimes = z.infer<typeof HeldDayTimesSchema>;
