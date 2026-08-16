import { z } from 'zod';

import type { GradeType } from '../domain/model/valueObject/gradeType';
import type { LocationCode } from '../domain/model/valueObject/locationCode';
import type { PlaceHeldDays } from '../domain/model/valueObject/placeHeldDays';
import type { PlaceId } from '../domain/model/valueObject/placeId';
import type { RaceCourse } from '../domain/model/valueObject/raceCourse';
import type { RaceDateTime } from '../domain/model/valueObject/raceDateTime';
import { RaceDateTimeSchema } from '../domain/model/valueObject/raceDateTime';
import type { RaceType } from '../domain/model/valueObject/raceType';
import {
    gradeTypeSuperRefine,
    PLACE_GRADE_REQUIRED_ERROR,
    raceCourseSuperRefine,
    shouldHavePlaceGradeForMechanical,
} from '../domain/rule/raceInvariants';
import { findPlaceNameByCode } from '../domain/service/courseCode/officialCourseCode';
import { composePlaceId } from '../domain/service/identifier/composePlaceId';
import { createPlaceEntityBaseShape } from '../schemas/placeEntityShape';

/**
 * 開催場情報を表すエンティティのzod型定義
 *
 * 競馬・競輪などの開催場ごとの基本情報や開催日、場所コードなどを保持します。
 * PlaceHtmlEntityの上位互換で、placeIdを追加で持ちます。
 */
export const PlaceEntitySchema = z
    .object({
        ...createPlaceEntityBaseShape(),
        /** 開催日付 */
        datetime: RaceDateTimeSchema,
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
 * PlaceEntityの型定義
 */
export type PlaceEntity = z.infer<typeof PlaceEntitySchema>;

/**
 * PlaceEntityのバリデーション関数
 * @param entity - バリデーション対象のPlaceEntityオブジェクト
 * @returns バリデーション済みのPlaceEntityオブジェクト
 * @throws バリデーションエラーが発生した場合はzodのエラーをスローします。
 */
export const validatePlaceEntity = (entity: unknown): PlaceEntity => {
    return PlaceEntitySchema.parse(entity);
};

export const generatePlaceEntity = (
    raceType: RaceType,
    datetime: RaceDateTime,
    locationCode: LocationCode,
    placeGrade: GradeType | undefined,
    placeHeldDays: PlaceHeldDays | undefined,
): PlaceEntity => {
    const placeId: PlaceId = composePlaceId(raceType, datetime, locationCode);
    const raceCourse: RaceCourse | null = findPlaceNameByCode(
        locationCode,
        raceType,
    );
    if (!raceCourse) {
        throw new Error(
            `Invalid location code for generating PlaceEntity: ${locationCode}`,
        );
    }
    return validatePlaceEntity({
        placeId,
        raceType,
        datetime,
        raceCourse,
        locationCode,
        placeGrade,
        placeHeldDays,
    });
};
