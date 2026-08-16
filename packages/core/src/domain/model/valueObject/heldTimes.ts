import { z } from 'zod';

/**
 * HeldTimesのzod型定義
 */
export const HeldTimesSchema = z
    .number()
    .int()
    .min(1, '開催回数は1以上である必要があります')
    .max(99, '開催回数は99以下である必要があります');

/**
 * HeldTimesの型定義
 */
export type HeldTimes = z.infer<typeof HeldTimesSchema>;
