import { z } from 'zod';

import { parseWithValidation, searchFilterBaseFields } from './common';

/**
 * 場所検索フィルターパラメータのスキーマ（GET用）
 * 共通フィールドに place 固有の `isDisplayPlaceGrade` を追加する。
 */
export const searchPlaceFilterParamsSchema = z
    .object({
        ...searchFilterBaseFields,
        isDisplayPlaceGrade: z.boolean().optional(),
    })
    .strict();

export type SearchPlaceFilterParamsInput = z.infer<
    typeof searchPlaceFilterParamsSchema
>;

/**
 * 場所検索フィルターパラメータを検証してパースする
 * @param input
 */
export const parseSearchPlaceFilterParams = (
    input: unknown,
): SearchPlaceFilterParamsInput =>
    parseWithValidation(searchPlaceFilterParamsSchema, input);
