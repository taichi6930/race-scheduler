import {
    findPlaceNameByCode,
    formatZodIssues,
    isIncludedRaceType,
    isMechanicalRace,
    type PlaceEntity,
    PlaceEntitySchema,
    RaceType,
    validateLocationCode,
    validateRaceType,
} from '@race-schedule/core';
import { z } from 'zod';

/**
 * Drizzle が返す place 行（camelCase、常に place_grade / place_held_day を
 * LEFT JOIN した形）の型検証スキーマ
 *
 * RaceMapper / PlayerRepository の raw 行検証様式に倣い、生 DB 行を検証してから使用する。
 * 各カラムの型は「現状キャストで通っていた値をすべて許容する」ことを最優先とし、
 * 文字列 / 数値 / null / undefined を必要に応じて受け入れる permissive な定義とする。
 * 値の整形（String() / Number() による変換）は従来どおり行い、
 * 生成される PlaceEntity は現状と完全一致させる。
 */
const placeRowSchema = z.object({
    placeId: z.union([z.string(), z.number()]),
    raceType: z.union([z.string(), z.number()]),
    dateTime: z.union([z.string(), z.number()]),
    locationCode: z.union([z.string(), z.number()]),
    placeGrade: z.union([z.string(), z.number()]).nullish(),
    heldTimes: z.union([z.string(), z.number()]).nullish(),
    heldDayTimes: z.union([z.string(), z.number()]).nullish(),
    isRaceListAvailable: z.union([z.string(), z.number()]).nullish(),
});

type PlaceRow = z.infer<typeof placeRowSchema>;

/**
 * DBから返された行に placeGrade を含めるべきかを判定する。
 * 「includePlaceGrade 指定あり」「機械式種別」「placeGrade が取得できている」の
 * 3条件すべてを満たす場合のみ含める。呼び出し側の三項演算子に埋め込むと
 * 4項の複合条件（C2 の組み合わせ数が爆発する要因）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param row - DB検証済みの行データ
 * @param raceType - 検証済みの raceType
 * @param includePlaceGrade - 呼び出し元が placeGrade の取得を要求しているか
 */
const shouldIncludePlaceGrade = (
    row: PlaceRow,
    raceType: RaceType,
    includePlaceGrade: boolean | undefined,
): boolean =>
    Boolean(includePlaceGrade) &&
    isMechanicalRace(raceType) &&
    row.placeGrade !== undefined &&
    row.placeGrade !== null;

/**
 * DBから返された行に heldTimes（開催回数）のデータが存在するかを判定する。
 * 呼び出し側にインライン展開すると複合条件（&&）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param row - DB検証済みの行データ
 */
const hasHeldTimesValue = (row: PlaceRow): boolean =>
    row.heldTimes !== undefined && row.heldTimes !== null;

/**
 * DBから返された行の isRaceListAvailable が未設定（NULL/列なし）かどうかを判定する。
 * 呼び出し側にインライン展開すると複合条件（||）になるため、
 * 単独でテストできる名前付き関数として切り出す。
 * @param value - row.isRaceListAvailable の値
 */
const isRaceListAvailableValueMissing = (
    value: PlaceRow['isRaceListAvailable'],
): boolean => value === undefined || value === null;

/**
 * 生 DB 行を検証する（RaceMapper / PlayerRepository の様式に準拠）。
 * @param row - Drizzle から返された生の place 行
 */
const validatePlaceRow = (row: Record<string, unknown>): PlaceRow => {
    const rowValidationResult = placeRowSchema.safeParse(row);
    if (!rowValidationResult.success) {
        throw new Error(
            `Invalid place data from gateway: ${formatZodIssues(rowValidationResult.error.issues)}`,
        );
    }
    return rowValidationResult.data;
};

/**
 * placeGrade を含めるべきかを判定し、含めるなら文字列化して返す。
 * @param row - DB検証済みの行データ
 * @param raceType - 検証済みの raceType
 * @param includePlaceGrade - 呼び出し元が placeGrade の取得を要求しているか
 */
const resolvePlaceGrade = (
    row: PlaceRow,
    raceType: RaceType,
    includePlaceGrade: boolean | undefined,
): string | undefined =>
    shouldIncludePlaceGrade(row, raceType, includePlaceGrade)
        ? String(row.placeGrade)
        : undefined;

/**
 * placeHeldDays（開催回数・日数）を解決する。
 * JRA の場合は必須のため、データがなければ最小値（1, 1）をデフォルトとする。
 * @param row - DB検証済みの行データ
 * @param raceType - 検証済みの raceType
 */
const resolvePlaceHeldDays = (
    row: PlaceRow,
    raceType: RaceType,
): Record<string, number> | undefined => {
    if (hasHeldTimesValue(row)) {
        return {
            heldTimes: Number(row.heldTimes),
            heldDayTimes: Number(row.heldDayTimes),
        };
    }
    if (isIncludedRaceType(raceType, [RaceType.JRA])) {
        // JRA の場合、データがない場合もデフォルト値を設定（最小値は1、0は無効）
        return { heldTimes: 1, heldDayTimes: 1 };
    }
    return;
};

/**
 * レース情報取得可否（place.is_race_list_available）を boolean へ変換する。
 * NULL / 列なしの場合は undefined（非該当）。
 * @param row - DB検証済みの行データ
 */
const resolveIsRaceListAvailable = (row: PlaceRow): boolean | undefined =>
    isRaceListAvailableValueMissing(row.isRaceListAvailable)
        ? undefined
        : Number(row.isRaceListAvailable) === 1;

/**
 * 組み立てた rawEntity をスキーマで検証し、PlaceEntity として返す。
 * @param rawEntity - 組み立て済みの検証前エンティティ
 */
const buildValidatedPlaceEntity = (rawEntity: unknown): PlaceEntity => {
    const validationResult = PlaceEntitySchema.safeParse(rawEntity);
    if (!validationResult.success) {
        throw new Error(
            `Invalid place data from gateway: ${formatZodIssues(validationResult.error.issues)}`,
        );
    }
    return validationResult.data;
};

/**
 * DBから返されるPlaceのRawデータをEntityに変換し、同時にスキーマで検証
 */
export const PlaceMapper = {
    /**
     * 生DBのPlace行データをPlaceEntityに変換する
     * @param row - Drizzleから返された生のPlace行
     * @param options - 変換オプション（includePlaceGrade: placeGradeを含めるかどうか）
     * @returns 検証済みのPlaceEntity
     */
    toEntity(
        row: Record<string, unknown>,
        options?: { includePlaceGrade?: boolean },
    ): PlaceEntity {
        const validatedRow = validatePlaceRow(row);
        const raceType = validateRaceType(String(validatedRow.raceType));
        const placeGrade = resolvePlaceGrade(
            validatedRow,
            raceType,
            options?.includePlaceGrade,
        );

        // findPlaceNameByCode から raceCourse を解決
        const placeName =
            findPlaceNameByCode(
                validateLocationCode(String(validatedRow.locationCode)),
                raceType,
            ) ?? String(validatedRow.locationCode);

        const placeHeldDays = resolvePlaceHeldDays(validatedRow, raceType);
        const isRaceListAvailable = resolveIsRaceListAvailable(validatedRow);

        const rawEntity = {
            placeId: String(validatedRow.placeId),
            raceType: String(validatedRow.raceType),
            datetime: new Date(validatedRow.dateTime),
            locationCode: String(validatedRow.locationCode),
            raceCourse: placeName,
            placeHeldDays,
            ...(placeGrade !== undefined && { placeGrade }),
            ...(isRaceListAvailable !== undefined && { isRaceListAvailable }),
        };

        return buildValidatedPlaceEntity(rawEntity);
    },
};
