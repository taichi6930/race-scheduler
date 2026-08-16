import { z } from 'zod';

import {
    gradeTypeSuperRefine,
    PLACE_GRADE_REQUIRED_ERROR,
    PLACE_HELD_DAYS_REQUIRED_ERROR,
    raceCourseSuperRefine,
    shouldHavePlaceGradeForMechanical,
    shouldHavePlaceHeldDaysForJra,
} from '../domain/rule/raceInvariants';
import { ValidationError } from '../utilities/validationError';
import {
    dedupeByLastOccurrence,
    extractIndexedIssue,
    formatZodIssues,
} from './common';
import { createPlaceEntityBaseShape } from './placeEntityShape';

const PlaceEntityUpsertItemSchema = z
    .object({
        ...createPlaceEntityBaseShape(),
        /**
         * Upsert用のdatetime定義（Entityと異なりJSON入力からの文字列を
         * Date型へ自動変換するpreprocessを持つ）
         */
        datetime: z.preprocess((value) => {
            if (typeof value === 'string') {
                return new Date(value);
            }
            return value;
        }, z.date()),
    })
    .refine(shouldHavePlaceHeldDaysForJra, {
        ...PLACE_HELD_DAYS_REQUIRED_ERROR,
    })
    .refine(shouldHavePlaceGradeForMechanical, {
        ...PLACE_GRADE_REQUIRED_ERROR,
    })
    .superRefine((data, context) =>
        gradeTypeSuperRefine(
            context,
            data.raceType,
            data.placeGrade,
            'placeGrade',
            {
                optional: true,
            },
        ),
    )
    .superRefine(raceCourseSuperRefine);

/**
 * PlaceEntity配列のアップサートスキーマ
 */
const placeEntityUpsertSchema = PlaceEntityUpsertItemSchema.array()
    .min(1, '配列は1件以上必要です')
    .transform((items) =>
        // 同一バッチ内でのplaceId重複を検知する（VAL-05）。重複があるとUPSERT挙動が
        // 未定義になるため、後勝ち（最後に出現した要素）を採用して一意化する。
        dedupeByLastOccurrence(items, (item) => item.placeId, 'placeId'),
    );

type PlaceEntityUpsertInput = z.infer<typeof placeEntityUpsertSchema>;

/**
 * PlaceEntity配列を検証してパースする
 * @param input
 */
export const parsePlaceEntityUpsert = (
    input: unknown,
): PlaceEntityUpsertInput => {
    const result = placeEntityUpsertSchema.safeParse(input);
    if (!result.success) {
        // 配列要素の検証エラーを処理
        const indexedIssue = extractIndexedIssue(result.error.issues[0]);
        if (indexedIssue) {
            const indexError = new ValidationError(indexedIssue.message, 400);
            indexError.index = indexedIssue.index;
            throw indexError;
        }
        // その他の検証エラー（パス情報を含める）
        throw new ValidationError(formatZodIssues(result.error.issues), 400);
    }
    return result.data;
};
