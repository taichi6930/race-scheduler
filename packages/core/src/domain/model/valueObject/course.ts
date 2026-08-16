import z from 'zod';

import { raceCourseSuperRefine } from '../../rule/raceInvariants';
import { LocationCodeSchema } from './locationCode';
import { RaceTypeSchema } from './raceType';

/**
 * コース情報のスキーマ（型検証付き）
 * raceTypeに応じた有効なraceCourseの検証を含む
 */
export const CourseSchema = z
    .object({
        raceType: RaceTypeSchema,
        raceCourse: z.string(),
        placeCode: LocationCodeSchema,
    })
    .superRefine(raceCourseSuperRefine);

/**
 * コース情報の型定義
 */
export type Course = z.infer<typeof CourseSchema>;
