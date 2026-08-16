import { z } from 'zod';

import {
    conditionDataRequiredSuperRefine,
    gradeTypeSuperRefine,
    PLACE_HELD_DAYS_REQUIRED_ERROR,
    raceCourseSuperRefine,
    raceStageRequiredSuperRefine,
    shouldHavePlaceHeldDaysForJra,
} from '../domain/rule/raceInvariants';
import { ValidationError } from '../utilities/validationError';
import {
    dedupeByLastOccurrence,
    extractIndexedIssue,
    formatZodIssues,
    RaceGradeField,
} from './common';
import { createRaceEntityBaseShape } from './raceEntityShape';

/**
 * RaceEntity配列のアップサートスキーマ
 * JSON入力からのdatetime文字列をDate型に自動変換
 */
const RaceEntityUpsertItemSchema = z
    .object({
        ...createRaceEntityBaseShape(),
        datetime: z.preprocess((value) => {
            if (typeof value === 'string') return new Date(value);
            return value;
        }, z.date()),
        raceGrade: RaceGradeField,
    })
    .superRefine(raceCourseSuperRefine)
    .superRefine((data, context) =>
        gradeTypeSuperRefine(
            context,
            data.raceType,
            data.raceGrade,
            'raceGrade',
        ),
    )
    .refine(shouldHavePlaceHeldDaysForJra, {
        ...PLACE_HELD_DAYS_REQUIRED_ERROR,
    })
    .superRefine(raceStageRequiredSuperRefine)
    .superRefine(conditionDataRequiredSuperRefine);

export const raceEntityUpsertSchema = RaceEntityUpsertItemSchema.array()
    .min(1, '配列は1件以上必要です')
    .transform((items) =>
        // 同一バッチ内でのraceId重複を検知する（VAL-05）。重複があるとUPSERT挙動が
        // 未定義になるため、後勝ち（最後に出現した要素）を採用して一意化する。
        dedupeByLastOccurrence(items, (item) => item.raceId, 'raceId'),
    );

export type RaceEntityUpsertInput = z.infer<typeof raceEntityUpsertSchema>;

/**
 * RaceEntity配列を検証してパースする
 * @param input
 */
export const parseRaceEntityUpsert = (
    input: unknown,
): RaceEntityUpsertInput => {
    const result = raceEntityUpsertSchema.safeParse(input);
    if (!result.success) {
        // 配列要素の検証エラーを処理
        const indexedIssue = extractIndexedIssue(result.error.issues[0]);
        if (indexedIssue) {
            const indexError = new ValidationError(indexedIssue.message, 400);
            indexError.index = indexedIssue.index;
            throw indexError;
        }
        throw new ValidationError(formatZodIssues(result.error.issues), 400);
    }
    return result.data;
};
