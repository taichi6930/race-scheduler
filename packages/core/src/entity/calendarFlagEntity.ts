import { z } from 'zod';

import { RaceIdSchema } from '../domain/model/valueObject/raceId';

/**
 * 指定レース（カレンダー登録フラグ）のスキーマと型定義
 * @remarks
 * グレードに関係なく、ユーザーが個別に指定したレースを常にカレンダー登録対象にするためのフラグ。
 */
export const CalendarFlagEntitySchema = z.object({
    raceId: RaceIdSchema,
    label: z.string(),
});

/**
 * CalendarFlagEntityの型定義
 */
export type CalendarFlagEntity = z.infer<typeof CalendarFlagEntitySchema>;

/**
 * CalendarFlagEntityのバリデーション関数
 * @param input - バリデーション対象のオブジェクト
 * @returns バリデーション済みのCalendarFlagEntityオブジェクト
 * @throws バリデーションエラーが発生した場合はzodのエラーをスローします。
 */
export const validateCalendarFlagEntity = (
    input: unknown,
): CalendarFlagEntity => CalendarFlagEntitySchema.parse(input);
