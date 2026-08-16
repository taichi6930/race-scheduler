import { z } from 'zod';

import { RaceDateTimeSchema } from '../domain/model/valueObject/raceDateTime';
import {
    conditionDataRequiredSuperRefine,
    gradeTypeSuperRefine,
    raceCourseSuperRefine,
    raceStageRequiredSuperRefine,
} from '../domain/rule/raceInvariants';
import { createRaceEntityBaseShape } from '../schemas/raceEntityShape';

/**
 * レース情報を表すエンティティのzod型定義
 *
 * 競馬・競輪などのレース情報を保持します。
 * RaceHtmlEntityの上位互換で、raceIdを追加で持ちます。
 * バリデーションルール：
 * - placeNameはraceTypeに応じた有効な開催場名である必要があります。
 * - raceGradeはraceTypeに応じた有効なグレードである必要があります。
 * - placeHeldDaysはJRA以外では使用されません（すべてのraceTypeで省略可）。
 * - conditionDataはJRA/NAR/OVERSEASの場合は必須です（それ以外は省略可）。
 * - stageはKEIRIN/AUTORACE/BOATRACEの場合は必須です（それ以外は省略可）。
 */
export const RaceEntitySchema = z
    .object({
        ...createRaceEntityBaseShape(),
        /** 開催日付 */
        datetime: RaceDateTimeSchema,
        /** レース等級（raceType毎の有効なグレード値をバリデーション） */
        raceGrade: z.string(),
    })
    .superRefine((data, context) =>
        gradeTypeSuperRefine(
            context,
            data.raceType,
            data.raceGrade,
            'raceGrade',
        ),
    )
    .superRefine(raceCourseSuperRefine)
    .superRefine(raceStageRequiredSuperRefine)
    .superRefine(conditionDataRequiredSuperRefine);

/**
 * RaceEntityの型定義
 */
export type RaceEntity = z.infer<typeof RaceEntitySchema>;

/**
 * RaceEntityのバリデーション関数
 * @param entity - バリデーション対象のRaceEntityオブジェクト
 * @returns バリデーション済みのRaceEntityオブジェクト
 * @throws バリデーションエラーが発生した場合はzodのエラーをスローします。
 */
export const validateRaceEntity = (entity: unknown): RaceEntity => {
    return RaceEntitySchema.parse(entity);
};
