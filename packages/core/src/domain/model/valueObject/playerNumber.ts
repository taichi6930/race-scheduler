import { z } from 'zod';

/**
 * PlayerNumberのzod型定義
 */
export const PlayerNumberSchema = z
    .number()
    .int()
    .min(1, '選手番号は1以上である必要があります');

/**
 * PlayerNumberの型定義
 */
export type PlayerNumber = z.infer<typeof PlayerNumberSchema>;
