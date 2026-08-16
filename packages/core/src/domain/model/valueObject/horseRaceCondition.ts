import { z } from 'zod';

import { makeValidator } from '../../../utilities/makeValidator';
import { RaceDistanceSchema } from './raceDistance';
import { RaceSurfaceTypeSchema } from './surfaceType';

/**
 * HorseRaceConditionのzod型定義
 *
 * 競馬レースの馬場状態（芝・ダートなど）と距離をまとめて管理します。
 * - `surfaceType`: 馬場種別
 * - `distance`: 距離（メートル）
 */
export const HorseRaceConditionSchema = z.object({
    /** 馬場種別 */
    surfaceType: RaceSurfaceTypeSchema,
    /** 距離 */
    distance: RaceDistanceSchema,
});

/**
 * HorseRaceConditionの型定義
 */
export type HorseRaceCondition = z.infer<typeof HorseRaceConditionSchema>;

/**
 * 与えられた値を `HorseRaceCondition` としてバリデーションして返します。
 * 失敗した場合は zod の例外を投げます。
 * @param value
 */
export const validateHorseRaceCondition: (
    value: unknown,
) => HorseRaceCondition = makeValidator(HorseRaceConditionSchema);
