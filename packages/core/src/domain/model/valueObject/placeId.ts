import { z } from 'zod';

import { RaceType } from './raceType';

/**
 * placeIdのzod型定義
 */
export const PlaceIdSchema = z
    .string()
    .regex(
        new RegExp(
            String.raw`^(${Object.values(RaceType).join('|')})\d{8}[0-9]{2}$`,
        ),
        `placeIdは「RaceType(${Object.values(RaceType).join(', ')})+yyyymmdd(8桁数字)+location_code(数字2桁)」形式で指定してください 例: jra2025010501`,
    )
    .brand<'PlaceId'>();

/**
 * placeIdの型定義（brand付き公称型）
 */
export type PlaceId = z.infer<typeof PlaceIdSchema>;

/**
 * placeIdのバリデーション関数
 * @param value - placeId
 * @returns - バリデーション済みのplaceId
 */
export const validatePlaceId = (value: string): PlaceId =>
    PlaceIdSchema.parse(value);
