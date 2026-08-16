import { z } from 'zod';

import { parseWithValidation, raceTypeListField } from './common';

/**
 * 選手検索フィルターパラメータのスキーマ
 */
export const searchPlayerFilterParamsSchema = z
    .object({
        raceTypeList: raceTypeListField,
        /** 選手名の部分一致検索キーワード（任意）。未指定時は絞り込みを行わない */
        playerName: z.string().min(1).optional(),
    })
    .strict();

export type SearchPlayerFilterParamsInput = z.infer<
    typeof searchPlayerFilterParamsSchema
>;

/**
 * 選手検索フィルターパラメータを検証してパースする
 * @param input
 */
export const parseSearchPlayerFilterParams = (
    input: unknown,
): SearchPlayerFilterParamsInput =>
    parseWithValidation(searchPlayerFilterParamsSchema, input);
