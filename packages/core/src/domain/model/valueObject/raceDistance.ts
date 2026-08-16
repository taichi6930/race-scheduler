import { z } from 'zod';

import { makeValidator } from '../../../utilities/makeValidator';

/**
 * RaceDistanceのzod型定義
 */
export const RaceDistanceSchema = z
    .number()
    .positive('距離は0よりも大きい必要があります')
    .max(30_000, '距離は30000以下である必要があります');

/**
 * RaceDistanceの型定義
 */
export type RaceDistance = z.infer<typeof RaceDistanceSchema>;

/**
 * 競馬の距離をバリデーションする
 * @param distance - 距離
 */
export const validateRaceDistance: (distance: number) => RaceDistance =
    makeValidator(RaceDistanceSchema);
