import { z } from 'zod';

import { makeValidator } from '../../../utilities/makeValidator';
import { HeldDayTimesSchema } from './heldDayTimes';
import { HeldTimesSchema } from './heldTimes';

/**
 * PlaceHeldDaysのzod型定義
 *
 * 1つの開催場での開催回数や日数をまとめて管理します。
 * - `heldTimes`: 開催回数
 * - `heldDayTimes`: 開催日数
 */
export const PlaceHeldDaysSchema = z.object({
    /** 開催回数 */
    heldTimes: HeldTimesSchema,
    /** 開催日数 */
    heldDayTimes: HeldDayTimesSchema,
});

/**
 * PlaceHeldDaysの型定義
 */
export type PlaceHeldDays = z.infer<typeof PlaceHeldDaysSchema>;

/**
 * PlaceHeldDaysのzod検証関数
 *
 * 開催場の開催回・開催日・開催日時（heldTimes / heldDayTimes）を検証します。
 * @param value
 */
export const validatePlaceHeldDays: (value: unknown) => PlaceHeldDays =
    makeValidator(PlaceHeldDaysSchema);
