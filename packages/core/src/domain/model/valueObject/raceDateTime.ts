import { z } from 'zod';

/**
 * RaceDateTimeのzod型定義
 */
export const RaceDateTimeSchema = z.date();

/**
 * RaceDateTimeの型定義
 */
export type RaceDateTime = z.infer<typeof RaceDateTimeSchema>;
