import { z } from 'zod';

import { parseWithValidation, searchFilterBaseFields } from './common';

/**
 * レース検索フィルターパラメータのスキーマ
 */
export const searchRaceFilterParamsSchema = z
    .object(searchFilterBaseFields)
    .strict();

export type SearchRaceFilterParamsInput = z.infer<
    typeof searchRaceFilterParamsSchema
>;

/**
 * レース検索フィルターパラメータを検証してパースする
 * @param input
 */
export const parseSearchRaceFilterParams = (
    input: unknown,
): SearchRaceFilterParamsInput =>
    parseWithValidation(searchRaceFilterParamsSchema, input);
