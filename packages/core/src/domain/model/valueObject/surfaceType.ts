import { z } from 'zod';

import { makeValidator } from '../../../utilities/makeValidator';
import { RaceSurfaceTypeList } from '../../master/surfaceTypeMaster';

/**
 * RaceSurfaceTypeの型定義
 */
export const RaceSurfaceTypeSchema = z.string().refine((value) => {
    return RaceSurfaceTypeList.has(value);
}, '有効な馬場種別ではありません');

/**
 * RaceSurfaceTypeの型定義
 */
export type RaceSurfaceType = z.infer<typeof RaceSurfaceTypeSchema>;

/**
 * 馬場種別のバリデーション
 * @param surfaceType - 馬場種別
 * @returns - バリデーション済みの馬場種別
 */
export const validateRaceSurfaceType: (surfaceType: string) => RaceSurfaceType =
    makeValidator(RaceSurfaceTypeSchema);
