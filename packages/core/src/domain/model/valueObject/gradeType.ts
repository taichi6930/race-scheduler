import type { z } from 'zod';

import { makeRaceTypeScopedStringSchema } from '../../../utilities/makeRaceTypeScopedStringSchema';
import { GradeMaster } from '../../master/gradeMaster';
import type { RaceType } from './raceType';

/**
 * GradeTypeの型定義
 */
export type GradeType = z.infer<ReturnType<typeof GradeTypeSchema>>;

/**
 * グレード リスト
 * @param raceType - レース種別
 */
const GradeTypeList: (raceType: RaceType) => Set<string> = (raceType) =>
    new Set<string>(Object.keys(GradeMaster[raceType]));

/**
 * グレードのバリデーションスキーマを生成する
 * @param raceType - レース種別
 * @returns ZodString
 */
export const GradeTypeSchema = makeRaceTypeScopedStringSchema(
    GradeTypeList,
    (raceType) => `${raceType}のグレードではありません`,
);

/**
 * グレードのバリデーション
 * @param raceType - レース種別
 * @param grade - バリデーション対象のグレード
 * @returns バリデーション済みのグレード
 */
export const validateGradeType = (
    raceType: RaceType,
    grade: string,
): GradeType => GradeTypeSchema(raceType).parse(grade);
