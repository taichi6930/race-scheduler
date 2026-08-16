import { z } from 'zod';

import { LocationCodeSchema } from '../domain/model/valueObject/locationCode';
import { PlaceHeldDaysSchema } from '../domain/model/valueObject/placeHeldDays';
import { PlaceIdSchema } from '../domain/model/valueObject/placeId';
import { RaceTypeSchema } from '../domain/model/valueObject/raceType';
import { RaceCourseField } from './common';

/**
 * `PlaceEntitySchema`（entity/placeEntity.ts）と `placeEntityUpsertSchema`
 * （schemas/placeUpsertValidation.ts）で共通のフィールド定義。
 * @remarks
 * `datetime` のみ両スキーマで検証強度が異なる（Entity側はDate型、Upsert側は
 * 文字列→Date変換の preprocess）ため、このshapeには含めず各schema側で個別に定義する。
 */
export const createPlaceEntityBaseShape = () => ({
    /** 開催場ID（ユニーク） */
    placeId: PlaceIdSchema,
    /** レース種別（JRA/NAR/KEIRINなど） */
    raceType: RaceTypeSchema,
    /** 開催場名（place_master等から取得。raceTypeに応じた形式をバリデーション） */
    raceCourse: RaceCourseField,
    /** 開催場所コード */
    locationCode: LocationCodeSchema,
    /** 開催場グレード（省略可。raceType毎の有効なグレードをバリデーション） */
    placeGrade: z.string().optional(),
    /** 開催回数・日数情報（省略可） */
    placeHeldDays: PlaceHeldDaysSchema.optional(),
    /**
     * レース情報が取得可能か（省略可）
     *
     * NAR の月間開催ページでは開催マーカー（●等）のセルに、
     * KEIRIN/AUTORACE の月間開催ページではグレードアイコンのセルに、
     * レース一覧ページ（RaceList/AllRaceList/OneDayRaceList）へのリンクが
     * 張られているかを表す。
     * - `true`: リンクあり = レース情報を取得可能
     * - `false`: リンクなし = まだレース情報を取得できない
     * - `undefined`: 非該当（NAR/KEIRIN/AUTORACE 以外）またはレガシーデータ
     */
    isRaceListAvailable: z.boolean().optional(),
});
