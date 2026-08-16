import { z } from 'zod';

/**
 * locationCodeのzod型定義
 * 開催場コード（2桁の数字文字列）
 */
export const LocationCodeSchema = z
    .string()
    .regex(
        /^\d{2}$/,
        'locationCodeは2桁の数字で指定してください 例: 01, 02, 03',
    )
    .brand<'LocationCode'>();

/**
 * locationCodeの型定義
 */
export type LocationCode = z.infer<typeof LocationCodeSchema>;

/**
 * locationCodeのバリデーション関数
 * @param value - locationCode
 * @returns - バリデーション済みのlocationCode
 */
export const validateLocationCode = (value: string): LocationCode =>
    LocationCodeSchema.parse(value);
