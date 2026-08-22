import { z } from 'zod';

import {
    type PlaceHeldDays,
    PlaceHeldDaysSchema,
} from '../domain/model/valueObject/placeHeldDays';
import {
    type RaceType,
    RaceTypeSchema,
} from '../domain/model/valueObject/raceType';
import { createJstDate, splitCsv } from '../utilities';
import { ValidationError } from '../utilities/validationError';

/** placeHeldDaysMap クエリ（JSON 文字列）を検証するスキーマ */
const placeHeldDaysMapSchema = z.record(z.string(), PlaceHeldDaysSchema);

/**
 * YYYY-MM-DD 形式判定用の正規表現。
 * 呼び出しのたびにリテラルを再生成しないようモジュールスコープへ巻き上げる（PERF-088）。
 */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CommonSearchParams {
    startDate: Date;
    finishDate: Date;
    raceTypeList: RaceType[];
    locationList?: string[];
}

/**
 * startDate / finishDate のいずれかが未指定かどうかを判定する。
 * 複合条件（||）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param startDateRaw - startDate クエリパラメータの生値
 * @param finishDateRaw - finishDate クエリパラメータの生値
 * @returns いずれかが未指定なら true
 */
const isDateRangeMissing = (
    startDateRaw: string | null,
    finishDateRaw: string | null,
): boolean => !startDateRaw || !finishDateRaw;

/**
 * startDate/finishDate クエリ文字列を Date に変換する。
 * `YYYY-MM-DD` 形式は JST の日付として解釈し、finishDate は 23:59:59 とする。
 * `parseCommonSearchParams` 経由では `isDateRangeMissing` により null は事前に
 * 弾かれるため、value が null のガード（先頭の `if (!value)`）はテストから直接
 * 呼び出して検証する必要があり export している。
 * @param value - 日付文字列（null 許容）
 * @param isFinish - finishDate として解釈するか（true の場合 23:59:59 とする）
 */
export const dateTransform = (
    value: string | null,
    isFinish: boolean,
): Date => {
    if (!value) throw new Error('有効な日付形式が必要です');
    if (DATE_ONLY_PATTERN.test(value)) {
        const [y, m, d] = value.split('-').map(Number);
        const date = isFinish
            ? createJstDate(y, m, d, 23, 59, 59)
            : createJstDate(y, m, d);
        if (Number.isNaN(date.getTime())) {
            throw new TypeError('有効な日付形式ではありません');
        }
        return date;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new TypeError('有効な日付形式ではありません');
    }
    return date;
};

/**
 * raceTypeList クエリ文字列を RaceType[] に変換する。
 * #24: カンマ分割・trim・空要素除去は共通ユーティリティ splitCsv に、
 * RaceType 判定は共通スキーマ RaceTypeSchema に集約して重複実装を解消する。
 * 挙動不変を厳守: 無効な値は現状どおり黙って除外し、
 * 有効値が 0 件のときのみエラーとする（raceTypeListField の strict 判定とは意図的に異なる）。
 * `parseCommonSearchParams` 経由では呼び出し前に raceTypeListRaw の truthy
 * チェックが済んでいるため、value が null のガード（先頭の `if (!value)`）は
 * テストから直接呼び出して検証する必要があり export している。
 * @param value - raceTypeList クエリパラメータの生値
 */
export const parseRaceTypeList = (value: string | null): RaceType[] => {
    if (!value) throw new Error('raceTypeList is required');
    const raceTypeList = splitCsv(value)
        .map((v) => v.toLowerCase())
        .filter((v): v is RaceType => RaceTypeSchema.safeParse(v).success);
    if (raceTypeList.length === 0) {
        throw new Error('raceTypeListに有効な値がありません');
    }
    return raceTypeList;
};

/**
 * locationList クエリ文字列を string[] に変換する（未指定・空リストなら undefined）。
 * @param value - locationList クエリパラメータの生値
 */
const parseLocationList = (value: string | null): string[] | undefined => {
    if (!value) return;
    const list = splitCsv(value);
    return list.length > 0 ? list : undefined;
};

/**
 * catch節で捕捉したエラーからValidationErrorへ渡すメッセージ文字列を解決する。
 * `parseCommonSearchParams` 内で捕捉されうるエラーは現状すべて Error
 * （またはそのサブクラス）のため、`error instanceof Error` が false になる側は
 * 通常経路では到達しない。それでも防御的な既定値（'Validation error'）を
 * テストで直接検証できるよう、独立関数として export している。
 * @param error - catch節で捕捉したエラー
 * @returns ValidationError へ渡すメッセージ文字列
 */
export const resolveValidationErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Validation error';

export const parseCommonSearchParams = (
    searchParams: URLSearchParams,
): CommonSearchParams => {
    const startDateRaw = searchParams.get('startDate');
    const finishDateRaw = searchParams.get('finishDate');

    if (isDateRangeMissing(startDateRaw, finishDateRaw)) {
        throw new ValidationError('startDate, finishDateは必須です', 400);
    }

    const raceTypeListRaw = searchParams.get('raceTypeList');

    if (!raceTypeListRaw) {
        throw new ValidationError('raceTypeListは必須です', 400);
    }

    const locationListRaw = searchParams.get('locationList');

    try {
        // Zod スキーマでバリデーション
        return {
            startDate: dateTransform(startDateRaw, false),
            finishDate: dateTransform(finishDateRaw, true),
            raceTypeList: parseRaceTypeList(raceTypeListRaw),
            locationList: parseLocationList(locationListRaw),
        };
    } catch (error) {
        throw new ValidationError(resolveValidationErrorMessage(error), 400, {
            cause: error,
        });
    }
};

/** レース検索クエリ（placeIdList / placeHeldDaysMap）の解析結果。 */
interface RaceSearchParams {
    placeIdList: string[];
    placeHeldDaysMap?: Record<string, PlaceHeldDays>;
}

export const parseRaceSearchParams = (
    searchParams: URLSearchParams,
): RaceSearchParams => {
    const placeIdListRaw = searchParams.get('placeIdList');
    if (!placeIdListRaw) {
        throw new ValidationError('placeIdListは必須です', 400);
    }
    const placeIdList = splitCsv(placeIdListRaw);
    if (placeIdList.length === 0) {
        throw new ValidationError('placeIdListに有効な値がありません', 400);
    }

    let placeHeldDaysMap: Record<string, PlaceHeldDays> | undefined;
    const placeHeldDaysMapRaw = searchParams.get('placeHeldDaysMap');
    if (placeHeldDaysMapRaw) {
        try {
            // 外部由来の JSON を無検証で代入せず Zod で検証する。
            const parsed = placeHeldDaysMapSchema.safeParse(
                JSON.parse(placeHeldDaysMapRaw),
            );
            placeHeldDaysMap = parsed.success ? parsed.data : undefined;
        } catch {
            // パース失敗は無視してundefinedのままにする
        }
    }

    return { placeIdList, placeHeldDaysMap };
};
