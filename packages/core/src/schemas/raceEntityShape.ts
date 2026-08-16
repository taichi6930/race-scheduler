import { z } from 'zod';

import { HorseRaceConditionSchema } from '../domain/model/valueObject/horseRaceCondition';
import { LocationCodeSchema } from '../domain/model/valueObject/locationCode';
import { PlaceHeldDaysSchema } from '../domain/model/valueObject/placeHeldDays';
import { PlaceIdSchema } from '../domain/model/valueObject/placeId';
import { RaceIdSchema } from '../domain/model/valueObject/raceId';
import { RaceNameSchema } from '../domain/model/valueObject/raceName';
import { RaceNumberSchema } from '../domain/model/valueObject/raceNumber';
import { RaceTypeSchema } from '../domain/model/valueObject/raceType';
import { RacePlayerEntitySchema } from '../entity/racePlayerEntity';
import { RaceCourseField } from './common';

/**
 * `RaceEntitySchema`（entity/raceEntity.ts）と `raceEntityUpsertSchema`
 * （schemas/raceUpsertValidation.ts）で共通のフィールド定義。
 * @remarks
 * `datetime` と `raceGrade` は両スキーマで検証強度が異なるため
 * （Entity側はDate型・gradeTypeSuperRefineのみに検証を委ね、Upsert側はさらに
 * 文字列→Date変換の preprocess・`RaceGradeField` による min(1) を課す）、
 * このshapeには含めず各schema側で個別に定義する。
 */
export const createRaceEntityBaseShape = () => ({
    /** レースID（ユニーク）*/
    raceId: RaceIdSchema,
    /** 開催場ID */
    placeId: PlaceIdSchema,
    /** レース種別（JRA/NAR/KEIRINなど） */
    raceType: RaceTypeSchema,
    /** レース名（スクレイピングから取得） */
    raceName: RaceNameSchema,
    /** レース番号 */
    raceNumber: RaceNumberSchema,
    /** 開催場名 */
    raceCourse: RaceCourseField,
    /** 開催場所コード */
    locationCode: LocationCodeSchema,
    /** レースステージ（KEIRIN/AUTORACE/BOATRACEのみ、省略可） */
    raceStage: z.string().optional(),
    /**
     * raceStage がマスタ（stageByWebSite）に一致した確定値か（省略可）
     *
     * スクレイピング時にステージテキストがマスタに一致しなかった場合、
     * レースをドロップせず原文ママを raceStage に入れて仮登録するためのフラグ。
     * - `true`: マスタに一致した確定ステージ
     * - `false`: 未一致（原文ママの仮登録）。RaceStageSchema の許可リスト照合をスキップする
     * - `undefined`: 省略時は確定として扱う（DB側は列追加時に既存行を1=確定で後方互換）
     */
    raceStageConfirmed: z.boolean().optional(),
    /** 馬場状態（JRA/NAR/OVERSEASのみ） */
    conditionData: HorseRaceConditionSchema.optional(),
    /** 開催回数・日数情報（JRAのみ） */
    placeHeldDays: PlaceHeldDaysSchema.optional(),
    /** 出走選手一覧（KEIRINなど機械式競技のみ、省略可） */
    playerList: z.array(RacePlayerEntitySchema).optional(),
    /**
     * 開催情報が確定しているか（省略可）
     *
     * 公式発表前に運用者が過去の開催パターンから推測して先行登録した
     * 未来のレースを区別するためのフラグ。
     * - `true`: 確定情報
     * - `false`: 未確定（推測で登録された先の予定）
     * - `undefined`: 省略時は確定として扱う（DB側は列追加時に既存行を1=確定で後方互換）
     */
    isConfirmed: z.boolean().optional(),
});
