import { z } from 'zod';

import { makeValidator } from '../../../utilities/makeValidator';

/**
 * RaceNameのzod型定義
 */
export const RaceNameSchema = z
    .string()
    .min(1, '空文字は許可されていません')
    .max(200, 'レース名は200文字以下である必要があります');

/**
 * RaceNameの型定義
 */
export type RaceName = z.infer<typeof RaceNameSchema>;

/**
 * レース名のバリデーション
 * @param name - レース名
 * @returns - バリデーション済みのレース名
 */
export const validateRaceName: (name: string) => RaceName =
    makeValidator(RaceNameSchema);
