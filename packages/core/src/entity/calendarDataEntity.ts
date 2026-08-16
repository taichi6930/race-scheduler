import { z } from 'zod';

import { RaceTypeSchema } from '../domain/model/valueObject/raceType';

/**
 * カレンダーデータのスキーマと型定義
 */
const CalendarDataEntitySchema = z.object({
    id: z.string(),
    raceType: RaceTypeSchema,
    title: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    location: z.string(),
    description: z.string(),
});

/**
 * CalendarDataEntityの型定義
 */
export type CalendarDataEntity = z.infer<typeof CalendarDataEntitySchema>;

/**
 * CalendarDataEntityのバリデーション関数
 * @param input - バリデーション対象のオブジェクト
 * @returns バリデーション済みのCalendarDataEntityオブジェクト
 * @throws バリデーションエラーが発生した場合はzodのエラーをスローします。
 */
export const validateCalendarDataEntity = (
    input: unknown,
): CalendarDataEntity => CalendarDataEntitySchema.parse(input);
