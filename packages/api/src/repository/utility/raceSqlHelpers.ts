import type {
    RaceEntity,
    RaceType,
    SearchRaceFilterParamsInput,
} from '@race-schedule/core';
import {
    isHorseRace,
    isMechanicalRace,
    toJstISOString,
} from '@race-schedule/core';
import {
    between,
    eq,
    inArray,
    isNotNull,
    isNull,
    notInArray,
    or,
    sql,
} from 'drizzle-orm';

import {
    placeGrade,
    placeHeldDay,
    race,
    raceCondition,
    raceStage,
} from '../../db/schema';
import { RACE_TYPE_VALUES } from '../../utility/raceTypeConstants';
import { hasFilterValues } from './queryFilterHelpers';

/**
 * `RaceRepository` の fetch/upsert 用 SQL 補助（WHERE 句組み立て・INSERT 行変換・
 * SELECT 列挙）をまとめたモジュール。
 */

/** 競馬種別（race_condition を持つ種別）一覧。fetch の必須列フィルタで使う。 */
const HORSE_RACE_TYPES = RACE_TYPE_VALUES.filter((raceType) =>
    isHorseRace(raceType),
);

/**
 * fetch で実際に JOIN すべきテーブル（race_condition / race_stage）を表す。
 */
export interface RaceJoinTargets {
    /** race_condition（競馬種別のみが持つ）を JOIN するか */
    includeRaceCondition: boolean;
    /** race_stage（機械式レースのみが持つ）を JOIN するか */
    includeRaceStage: boolean;
}

/**
 * raceTypeList から、fetch で実際に必要な JOIN 対象を判定する。
 * @remarks
 * PERF-043: 従来は raceTypeList の内容によらず race_condition/race_stage を
 * 常に LEFT JOIN していた。raceTypeList が特定の種別に絞られている場合、
 * その種別に無関係なテーブルの JOIN を省略してクエリコストを下げる。
 * raceTypeList が未指定（絞り込みなし・全種別対象）の場合はどちらも必要。
 * @param raceTypeList - 検索フィルタの raceTypeList（空配列は絞り込みなしを意味する）
 * @returns race_condition / race_stage を JOIN するかを表す判定結果
 */
export const resolveRaceJoinTargets = (
    raceTypeList: RaceType[] | undefined,
): RaceJoinTargets => {
    if (!hasFilterValues(raceTypeList)) {
        return { includeRaceCondition: true, includeRaceStage: true };
    }
    return {
        includeRaceCondition: raceTypeList.some((raceType) =>
            isHorseRace(raceType),
        ),
        includeRaceStage: raceTypeList.some((raceType) =>
            isMechanicalRace(raceType),
        ),
    };
};

/**
 * RaceEntity を race テーブルへの INSERT 行に変換する。
 * @param entity - 変換対象のエンティティ
 */
export const toRaceInsertRow = (entity: RaceEntity) => ({
    raceId: entity.raceId,
    placeId: entity.placeId,
    raceType: entity.raceType,
    raceName: entity.raceName,
    dateTime:
        entity.datetime instanceof Date
            ? toJstISOString(entity.datetime)
            : entity.datetime,
    locationCode: entity.locationCode,
    grade: entity.raceGrade,
    raceNumber: entity.raceNumber,
    isConfirmed: entity.isConfirmed === false ? 0 : 1,
});

/**
 * race_stage が確定済み（is_confirmed=1）または race_stage を持たない
 * （LEFT JOIN未一致でNULL）行のみを通す条件。マスタ未一致の原文ママ仮登録
 * （is_confirmed=0）を公開fetch（fetch/fetchByRaceId 双方）から除外するために使う。
 */
export const buildRaceStageConfirmedCondition = () =>
    or(isNull(raceStage.isConfirmed), eq(raceStage.isConfirmed, 1));

/**
 * fetch の WHERE 句条件一覧を組み立てる。
 * 競馬レース（JRA/NAR/OVERSEAS）は race_condition が必須のため、
 * race_condition がないレース（データ不整合）は除外する
 * （KEIRIN/AUTORACE には race_condition がないため影響しない）。
 * @param params - 検索フィルタパラメータ
 * @param adjustedFinishDate - JST日付の最後（23:59:59）に調整済みの finishDate
 * @param includeRaceCondition - race_condition を JOIN しているか
 * （PERF-043: JOINしていない場合、race_condition を参照する条件は組み立てない。
 * 未JOINは「対象がすべて競馬系以外」の場合のみのため、条件を省略しても
 * 元々このOR条件は常に真になるだけで結果に影響しない）
 * @param includeRaceStage - race_stage を JOIN しているか（省略時は条件を追加しない。
 * PERF-043と同様、未JOINは「対象に機械式競技が無い」場合のみのため影響しない）
 */
export const buildRaceWhereConditions = (
    params: SearchRaceFilterParamsInput,
    adjustedFinishDate: Date,
    includeRaceCondition: boolean,
    includeRaceStage = false,
) => {
    const gradeExpression = sql<
        string | null
    >`COALESCE(${race.grade}, ${placeGrade.placeGrade})`;

    return [
        between(
            race.dateTime,
            toJstISOString(params.startDate),
            toJstISOString(adjustedFinishDate),
        ),
        includeRaceCondition
            ? or(
                  notInArray(race.raceType, HORSE_RACE_TYPES),
                  isNotNull(raceCondition.distance),
              )
            : undefined,
        hasFilterValues(params.raceTypeList)
            ? inArray(race.raceType, params.raceTypeList)
            : undefined,
        hasFilterValues(params.locationList)
            ? inArray(race.locationCode, params.locationList)
            : undefined,
        hasFilterValues(params.gradeList)
            ? inArray(gradeExpression, params.gradeList)
            : undefined,
        // マスタ（stageByWebSite）未一致の原文ママ仮登録（is_confirmed=0）は、
        // 確定するまで公開fetchの対象外とする（race_stage を持たない種別は対象外にしない）。
        includeRaceStage ? buildRaceStageConfirmedCondition() : undefined,
    ];
};

/**
 * fetch/fetchByRaceId 共通の SELECT 列挙。
 * @remarks
 * place_grade / place_held_day は常に LEFT JOIN する前提で列挙する。
 * race_stage / race_condition は `joinTargets` で実際に JOIN されている場合のみ
 * 実カラムを列挙し、JOINしていない場合は `NULL` リテラルを返す
 * （PERF-043: JOINしていないテーブルの列を参照するとSQLエラーになるため）。
 * どちらの場合も Mapper 側からは同じ `null` として扱われ、判定結果は変わらない。
 * @param joinTargets - race_condition / race_stage を実際に JOIN しているか
 */
export const selectRaceColumns = (joinTargets: RaceJoinTargets) => ({
    raceId: race.raceId,
    placeId: race.placeId,
    raceType: race.raceType,
    raceName: race.raceName,
    dateTime: race.dateTime,
    locationCode: race.locationCode,
    // race テーブルの grade があれば優先し、なければ place_grade テーブルの値を使う
    grade: sql<
        string | null
    >`COALESCE(${race.grade}, ${placeGrade.placeGrade})`,
    raceNumber: race.raceNumber,
    raceStage: joinTargets.includeRaceStage
        ? raceStage.raceStage
        : sql<string | null>`NULL`,
    raceStageConfirmed: joinTargets.includeRaceStage
        ? raceStage.isConfirmed
        : sql<number | null>`NULL`,
    distance: joinTargets.includeRaceCondition
        ? raceCondition.distance
        : sql<number | null>`NULL`,
    surfaceType: joinTargets.includeRaceCondition
        ? raceCondition.surfaceType
        : sql<string | null>`NULL`,
    heldTimes: placeHeldDay.heldTimes,
    heldDayTimes: placeHeldDay.heldDayTimes,
    isConfirmed: race.isConfirmed,
});
