import type { RefinementCtx } from 'zod';
import { z } from 'zod';

import { GradeTypeSchema } from '../model/valueObject/gradeType';
import { RaceCourseSchema } from '../model/valueObject/raceCourse';
import { RaceStageSchema } from '../model/valueObject/raceStage';
import { RaceType } from '../model/valueObject/raceType';
import { isHorseRace, isMechanicalRace } from './raceClassification';

/**
 * ZodError（またはその他の例外）から表示用メッセージを取り出す。
 * 各所にコピペされていた `error instanceof z.ZodError ? issues[0]?.message ?? fallback : fallback`
 * の分岐（`??` / `||` 混在含む）を 1 箇所に統一する。
 * @param error - catch した例外
 * @param fallback - メッセージが取得できないときの既定文言
 * @returns 表示用メッセージ
 */
export const zodErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof z.ZodError
        ? (error.issues[0]?.message ?? fallback)
        : fallback;

/**
 * KEIRIN/AUTORACE/BOATRACEの場合にplaceGradeが必須であることを検証する述語関数
 * @param data
 * @param data.raceType
 * @param data.placeGrade
 */
export const shouldHavePlaceGradeForMechanical = (data: {
    raceType: RaceType;
    placeGrade?: string;
}): boolean =>
    !isMechanicalRace(data.raceType) || data.placeGrade !== undefined;

export const PLACE_GRADE_REQUIRED_ERROR = {
    message: 'placeGrade is required for KEIRIN/AUTORACE/BOATRACE',
    // SAFETY: 単一要素のリテラル配列を Zod issue の path（string[]）として渡すための
    // 型の広げ直しであり、要素は固定の 'placeGrade' 一つだけなので実行時の値は変わらない。
    path: ['placeGrade'] as string[],
};

/**
 * JRA/NAR/OVERSEASの場合にconditionDataが必須であることを検証する述語関数
 * @param data
 * @param data.raceType
 * @param data.conditionData
 */
export const shouldHaveConditionDataForHorse = (data: {
    raceType: RaceType;
    conditionData?: unknown;
}): boolean => !isHorseRace(data.raceType) || data.conditionData !== undefined;

export const CONDITION_DATA_REQUIRED_ERROR = {
    message: 'conditionData is required for JRA/NAR/OVERSEAS',
    // SAFETY: 単一要素のリテラル配列を Zod issue の path（string[]）として渡すための
    // 型の広げ直しであり、要素は固定の 'conditionData' 一つだけなので実行時の値は変わらない。
    path: ['conditionData'] as string[],
};

/**
 * 開催場一覧ページで「レース一覧へのリンクの有無」を見て
 * レース情報取得の要否を判定できるレース種別。
 */
const RACE_TYPES_WITH_RACE_LIST_LINK_CHECK = new Set<RaceType>([
    RaceType.NAR,
    RaceType.KEIRIN,
    RaceType.AUTORACE,
]);

/**
 * 開催場について、開催場一覧ページ上のレース一覧へのリンクが張られておらず
 * レース情報を取得できない（isRaceListAvailable === false）かどうかを判定する。
 *
 * NAR/KEIRIN/AUTORACE の月間開催ページは、開催日であってもレース一覧への
 * リンクがまだ張られていない日があり、その場合レース情報を取得できない。
 * true / undefined（非該当・レガシー）は取得対象とする。
 * @param data - raceType と isRaceListAvailable を持つ検証対象
 * @param data.raceType - レース種別
 * @param data.isRaceListAvailable - 開催場のレース一覧リンク有無（対象外・レガシーは undefined）
 * @returns NAR/KEIRIN/AUTORACE かつレース一覧リンクが無ければ true
 */
export const isPlaceWithoutRaceList = (data: {
    raceType: RaceType;
    isRaceListAvailable?: boolean;
}): boolean =>
    RACE_TYPES_WITH_RACE_LIST_LINK_CHECK.has(data.raceType) &&
    data.isRaceListAvailable === false;

/**
 * JRA/NAR/OVERSEAS の場合に conditionData が必須であることを検証する superRefine コールバック。
 * entity / raceUpsert の 2 箇所に同一の判定＋addIssue がコピペされていた重複を集約する。
 * addIssue の path / message / code は元実装と完全一致する。
 * @param data - raceType と conditionData を持つ検証対象
 * @param data.raceType - レース種別
 * @param data.conditionData - 馬場状態
 * @param context - Zod の RefinementCtx
 */
export const conditionDataRequiredSuperRefine = (
    data: { raceType: RaceType; conditionData?: unknown },
    context: RefinementCtx,
): void => {
    if (!shouldHaveConditionDataForHorse(data)) {
        context.addIssue({
            code: 'custom',
            path: ['conditionData'],
            message: CONDITION_DATA_REQUIRED_ERROR.message,
        });
    }
};

/**
 * JRA の場合に placeHeldDays が必須であることを検証する述語関数。
 * raceUpsert / placeUpsert の 2 箇所に同一ロジックがコピペされていた重複を集約する。
 * @param data - raceType と placeHeldDays を持つ検証対象
 * @param data.raceType - レース種別
 * @param data.placeHeldDays - 開催回数・日数情報
 * @returns JRA 以外、または placeHeldDays が存在すれば true
 */
export const shouldHavePlaceHeldDaysForJra = (data: {
    raceType: RaceType;
    placeHeldDays?: unknown;
}): boolean =>
    data.placeHeldDays !== undefined || data.raceType !== RaceType.JRA;

export const PLACE_HELD_DAYS_REQUIRED_ERROR = {
    message: 'placeHeldDays is required for JRA',
    // SAFETY: 単一要素のリテラル配列を Zod issue の path（string[]）として渡すための
    // 型の広げ直しであり、要素は固定の 'placeHeldDays' 一つだけなので実行時の値は変わらない。
    path: ['placeHeldDays'] as string[],
};

export const RACE_STAGE_REQUIRED_ERROR = {
    message: 'raceStage is required for KEIRIN/AUTORACE/BOATRACE',
    // SAFETY: 単一要素のリテラル配列を Zod issue の path（string[]）として渡すための
    // 型の広げ直しであり、要素は固定の 'raceStage' 一つだけなので実行時の値は変わらない。
    path: ['raceStage'] as string[],
};

/**
 * KEIRIN/AUTORACE/BOATRACE で raceStage が未設定かどうかを判定する。
 * 複合条件（&&）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param data - raceType と raceStage を持つ検証対象
 * @param data.raceType - レース種別
 * @param data.raceStage - 開催ステージ
 * @returns 機械式競技かつ raceStage 未設定なら true
 */
const isRaceStageMissingForMechanical = (data: {
    raceType: RaceType;
    raceStage?: string;
}): boolean => isMechanicalRace(data.raceType) && data.raceStage === undefined;

/**
 * raceStage を raceType に応じた RaceStageSchema で検証し、機械式競技での
 * 必須性も検証する superRefine コールバック。
 * raceStageConfirmed が false（マスタ未一致の仮登録）の場合は許可リスト照合を
 * スキップし、非空文字列であることのみ要求する。
 * @param data - raceType と raceStage を持つ検証対象
 * @param data.raceType - レース種別
 * @param data.raceStage - 開催ステージ
 * @param data.raceStageConfirmed - raceStage がマスタに一致した確定値か（省略可、省略時は確定扱い）
 * @param context - Zod の RefinementCtx
 */
export const raceStageRequiredSuperRefine = (
    data: {
        raceType: RaceType;
        raceStage?: string;
        raceStageConfirmed?: boolean;
    },
    context: RefinementCtx,
): void => {
    if (data.raceStage !== undefined) {
        if (data.raceStageConfirmed === false) {
            // 仮登録（マスタ未一致の原文ママ）: 許可リスト照合はスキップし、
            // 非空文字列であることのみ要求する。
            if (data.raceStage.trim() === '') {
                context.addIssue({
                    code: 'custom',
                    path: ['raceStage'],
                    message: RACE_STAGE_REQUIRED_ERROR.message,
                });
            }
        } else {
            try {
                RaceStageSchema(data.raceType).parse(data.raceStage);
            } catch (error) {
                context.addIssue({
                    code: 'custom',
                    path: ['raceStage'],
                    message: zodErrorMessage(error, 'Invalid stage'),
                });
            }
        }
    }
    if (isRaceStageMissingForMechanical(data)) {
        context.addIssue({
            code: 'custom',
            path: ['raceStage'],
            message: RACE_STAGE_REQUIRED_ERROR.message,
        });
    }
};

/**
 * raceCourse を raceType に応じた RaceCourseSchema で検証する superRefine コールバック。
 * entity / upsert / course の 5 箇所に同一の try/catch がコピペされていた重複を集約する。
 * エラー path は常に `['raceCourse']` に統一（旧実装は一部 `['placeName']` を使う不整合バグがあった）。
 * @param data - raceType と raceCourse を持つ検証対象
 * @param data.raceType - レース種別
 * @param data.raceCourse - 開催場名
 * @param context - Zod の RefinementCtx
 */
export const raceCourseSuperRefine = (
    data: { raceType: RaceType; raceCourse: string },
    context: RefinementCtx,
): void => {
    try {
        RaceCourseSchema(data.raceType).parse(data.raceCourse);
    } catch (error) {
        context.addIssue({
            code: 'custom',
            path: ['raceCourse'],
            message: zodErrorMessage(error, 'Invalid race course'),
        });
    }
};

/**
 * value が未設定かつ optional 指定であるかどうかを判定する（検証スキップ条件）。
 * 複合条件（&&）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param value - 検証対象のグレード値
 * @param optional - 検証を省略してよいかどうか
 * @returns 検証をスキップすべきなら true
 */
const shouldSkipGradeTypeValidation = (
    value: string | undefined,
    optional: boolean | undefined,
): boolean => value === undefined && !!optional;

/**
 * grade（raceGrade / placeGrade）を raceType に応じた GradeTypeSchema で検証する superRefine ヘルパー。
 * entity / upsert の 4 箇所に同一の try/catch がコピペされていた重複を集約する。
 * @param context - Zod の RefinementCtx
 * @param raceType - レース種別
 * @param value - 検証対象のグレード値
 * @param path - エラーを紐付けるフィールド名（'raceGrade' / 'placeGrade'）
 * @param options - `optional: true` の場合、value が undefined なら検証をスキップ
 * @param options.optional
 */
export const gradeTypeSuperRefine = (
    context: RefinementCtx,
    raceType: RaceType,
    value: string | undefined,
    path: string,
    options: { optional?: boolean } = {},
): void => {
    if (shouldSkipGradeTypeValidation(value, options.optional)) {
        return;
    }
    try {
        GradeTypeSchema(raceType).parse(value);
    } catch (error) {
        context.addIssue({
            code: 'custom',
            path: [path],
            message: zodErrorMessage(error, 'Invalid grade'),
        });
    }
};
