import type { RaceEntity } from '@race-schedule/core';
import {
    findPlaceNameByCode,
    formatZodIssues,
    RaceEntitySchema,
    validateLocationCode,
    validateRaceType,
} from '@race-schedule/core';
import { z } from 'zod';

/**
 * Drizzle が返す race 行（camelCase、常に place_grade/race_stage/race_condition/
 * place_held_day を LEFT JOIN した形）の型検証スキーマ
 *
 * PlayerRepository の raw 行検証様式に倣い、生 DB 行を検証してから使用する。
 * 各カラムの型は「現状キャストで通っていた値をすべて許容する」ことを最優先とし、
 * 文字列 / 数値 / null / undefined を必要に応じて受け入れる permissive な定義とする。
 * 値の整形（String() / Number() / ?? による既定値）は従来どおり行い、
 * 生成される RaceEntity は現状と完全一致させる。
 */
const raceRowSchema = z.object({
    raceId: z.union([z.string(), z.number()]),
    placeId: z.union([z.string(), z.number()]),
    raceType: z.union([z.string(), z.number()]),
    dateTime: z.union([z.string(), z.number()]),
    locationCode: z.union([z.string(), z.number()]),
    placeName: z.string().nullish(),
    raceName: z.string().nullish(),
    grade: z.string().nullish(),
    raceNumber: z.union([z.string(), z.number()]),
    heldTimes: z.union([z.string(), z.number()]).nullish(),
    heldDayTimes: z.union([z.string(), z.number()]).nullish(),
    raceStage: z.string().nullish(),
    raceStageConfirmed: z.union([z.string(), z.number()]).nullish(),
    distance: z.union([z.string(), z.number()]).nullish(),
    surfaceType: z.string().nullish(),
    isConfirmed: z.union([z.string(), z.number()]).nullish(),
});

/**
 * held_times（開催回数）のデータが存在するかを判定する。
 * 呼び出し側の三項演算子に埋め込むと複合条件（&&）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param heldTimes - DB検証済みの held_times 値
 */
const isHeldTimesPresent = (
    heldTimes: string | number | null | undefined,
): boolean => heldTimes !== undefined && heldTimes !== null;

/**
 * レースコンディション（distance / surface_type）のデータが両方揃っているかを判定する。
 * 呼び出し側の三項演算子に埋め込むと4項の複合条件（C2 の組み合わせ数が爆発する要因）に
 * なるため、単独でテストできる名前付き関数として切り出す。
 * @param distance - DB検証済みの distance 値
 * @param surfaceType - DB検証済みの surface_type 値
 */
const isRaceConditionDataPresent = (
    distance: string | number | null | undefined,
    surfaceType: string | null | undefined,
): boolean =>
    distance !== undefined &&
    distance !== null &&
    surfaceType !== undefined &&
    surfaceType !== null;

type RaceRow = z.infer<typeof raceRowSchema>;

/**
 * 生 DB 行を検証する（PlayerRepository の様式に準拠）。
 * @param row - Drizzle から返された生の race 行
 */
const validateRaceRow = (row: Record<string, unknown>): RaceRow => {
    const rowValidationResult = raceRowSchema.safeParse(row);
    if (!rowValidationResult.success) {
        throw new Error(
            `Invalid race data from gateway: ${formatZodIssues(rowValidationResult.error.issues)}`,
        );
    }
    return rowValidationResult.data;
};

/**
 * raceCourse を解決する。place_master に place_name があれば使い、
 * なければ findPlaceNameByCode からフォールバックする。
 * @param row - DB検証済みの行データ
 */
const resolveRaceCourse = (row: RaceRow): string =>
    row.placeName ??
    findPlaceNameByCode(
        validateLocationCode(String(row.locationCode)),
        validateRaceType(String(row.raceType)),
    ) ??
    '';

/**
 * placeHeldDays（開催回数・日数）を解決する。
 * @param row - DB検証済みの行データ
 */
const resolveRacePlaceHeldDays = (
    row: RaceRow,
): Record<string, number> | undefined =>
    isHeldTimesPresent(row.heldTimes)
        ? {
              heldTimes: Number(row.heldTimes),
              heldDayTimes: Number(row.heldDayTimes),
          }
        : undefined;

/**
 * row.isConfirmed が未設定（NULL/列なし）かどうかを判定する。
 * 呼び出し側にインライン展開すると複合条件（||）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param value - row.isConfirmed の値
 */
const isConfirmedValueMissing = (value: RaceRow['isConfirmed']): boolean =>
    value === undefined || value === null;

/**
 * is_confirmed（開催情報が確定しているか）を boolean へ変換する。
 * NOT NULL DEFAULT 1 の列だが、レガシー行・欠損時は確定扱い（true）にフォールバックする。
 * @param row - DB検証済みの行データ
 */
const resolveIsConfirmed = (row: RaceRow): boolean =>
    isConfirmedValueMissing(row.isConfirmed)
        ? true
        : Number(row.isConfirmed) === 1;

/**
 * row.raceStage が無い（race_stage が存在しない = 非機械式競技）かどうかを判定する。
 * @param raceStage - row.raceStage の値
 */
const isRaceStageAbsent = (raceStage: RaceRow['raceStage']): boolean =>
    raceStage === undefined || raceStage === null;

/**
 * row.raceStageConfirmed が未設定（NULL/列なし）かどうかを判定する。
 * @param value - row.raceStageConfirmed の値
 */
const raceStageConfirmedValueMissing = (
    value: RaceRow['raceStageConfirmed'],
): boolean => value === undefined || value === null;

/**
 * raceStage がマスタ（stageByWebSite）に一致した確定値かを boolean へ変換する。
 * race_stage が存在しない（非機械式競技）場合は undefined（対象外）を返す。
 * race_stage はあるが is_confirmed が欠損（NOT NULL DEFAULT 1 だが念のため）の場合は
 * 確定扱い（true）にフォールバックする。
 * @param row - DB検証済みの行データ
 */
const resolveRaceStageConfirmed = (row: RaceRow): boolean | undefined => {
    if (isRaceStageAbsent(row.raceStage)) {
        return;
    }
    return raceStageConfirmedValueMissing(row.raceStageConfirmed)
        ? true
        : Number(row.raceStageConfirmed) === 1;
};

/**
 * conditionData（distance / surfaceType）を解決する。
 * @param row - DB検証済みの行データ
 */
const resolveRaceConditionData = (
    row: RaceRow,
): { surfaceType: string | null | undefined; distance: number } | undefined =>
    isRaceConditionDataPresent(row.distance, row.surfaceType)
        ? {
              surfaceType: row.surfaceType,
              distance: Number(row.distance),
          }
        : undefined;

/**
 * 組み立てた rawEntity をスキーマで検証し、RaceEntity として返す。
 * @param rawEntity - 組み立て済みの検証前エンティティ
 */
const buildValidatedRaceEntity = (rawEntity: unknown): RaceEntity => {
    const validationResult = RaceEntitySchema.safeParse(rawEntity);
    if (!validationResult.success) {
        throw new Error(
            `Invalid race data from gateway: ${formatZodIssues(validationResult.error.issues)}`,
        );
    }
    return validationResult.data;
};

/**
 * DBから返されるRaceのRawデータをEntityに変換し、同時にスキーマで検証
 */
export const RaceMapper = {
    toEntity(row: Record<string, unknown>): RaceEntity {
        const validatedRow = validateRaceRow(row);

        const rawEntity = {
            raceId: String(validatedRow.raceId),
            placeId: String(validatedRow.placeId),
            raceType: String(validatedRow.raceType),
            datetime: new Date(validatedRow.dateTime),
            locationCode: String(validatedRow.locationCode),
            raceCourse: resolveRaceCourse(validatedRow),
            // レース名・等級はDBにカラムがあれば取得されるが、ない場合は空文字をデフォルトにする
            raceName: validatedRow.raceName ?? '',
            raceGrade: validatedRow.grade ?? '',
            raceNumber: Number(validatedRow.raceNumber),
            placeHeldDays: resolveRacePlaceHeldDays(validatedRow),
            // race_stage があれば設定
            raceStage: validatedRow.raceStage ?? undefined,
            raceStageConfirmed: resolveRaceStageConfirmed(validatedRow),
            conditionData: resolveRaceConditionData(validatedRow),
            isConfirmed: resolveIsConfirmed(validatedRow),
        };

        return buildValidatedRaceEntity(rawEntity);
    },
};
