import { z } from 'zod';

import { RaceTypeSchema } from '../domain/model/valueObject/raceType';

/**
 * RaceType配列のスキーマ
 */
export const raceTypeArraySchema = z.array(RaceTypeSchema).min(1);
