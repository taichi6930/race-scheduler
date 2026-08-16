import { MS_PER_DAY, RaceType } from '@race-schedule/core';

import type { BatchTarget } from './types';

/**
 * target が raceType 不問で 390 日を上限とする対象（place / calendar）かどうかを判定する。
 * 呼び出し側にインライン展開すると複合条件（||）になるため、単独でテストできる
 * 名前付き関数として切り出す。
 * @param target - バッチ対象
 * @returns raceType 不問で 390 日を上限とする対象であれば true
 */
const isUnconditional390DaysTarget = (target: BatchTarget): boolean =>
    target === 'place' || target === 'calendar';

/**
 * target / raceType 別の日付レンジ上限（日数）。
 * - place: 390 日（raceType 不問）
 * - calendar: 390 日（raceType 不問。Main API から読んで Google Calendar に
 *   反映するだけで対象サイトへのスクレイピングは発生しないため、race のような
 *   raceType 別の制限は不要）
 * - race の JRA: 35 日
 * - race の NAR: 35 日
 * - race の OVERSEAS: 390 日
 * - race のその他: 10 日（対象サイトへの逐次スクレイピング負荷を抑えるための制限）
 *
 * NAR が 10 日ではなく 35 日なのは、対象サイトへのアクセスが「日×開催場」ではなく
 * 月間ZIP 1 本に集約されており、日数を延ばしても外部サイトへの負荷が増えないため
 * （scraping 側の `RaceHtmlRepository` が同一期間のダウンロード・R2読み込みを
 * 1リクエスト内で1回にまとめる）。JRA と同じ 35 日にすることで、月をまたぐ
 * 1ヶ月分の指定をそのまま渡せる。
 *
 * router.ts（HTTP）と cli.ts（CLI）に別実装で重複していたマジック値・ロジックを集約する。
 * @param target - バッチ対象
 * @param raceType - レース種別
 * @returns 許容する日付レンジの上限日数
 */
export const getMaxRangeDays = (
    target: BatchTarget,
    raceType: RaceType,
): number => {
    if (isUnconditional390DaysTarget(target)) {
        return 390;
    }
    if (raceType === RaceType.JRA) {
        return 35;
    }
    if (raceType === RaceType.NAR) {
        return 35;
    }
    if (raceType === RaceType.OVERSEAS) {
        return 390;
    }
    return 10;
};

/**
 * 日付レンジ検証の失敗理由。
 * 呼び出し側（cli.ts / router.ts）が各自のエラー文言へマッピングするための識別子。
 * - `invalid-date`: startDate / finishDate のいずれかが不正な日付
 * - `negative-range`: finishDate が startDate より前
 * - `range-too-large`: 期間が上限（maxDays）を超過
 */
export type DateRangeValidationReason =
    | 'invalid-date'
    | 'negative-range'
    | 'range-too-large';

/**
 * 日付レンジ検証の結果。
 * 成功時は valid: true、失敗時は valid: false と失敗理由を持つ。
 */
export type DateRangeValidationResult =
    | { valid: true }
    | { valid: false; reason: DateRangeValidationReason };

/**
 * 開始日・終了日のいずれかが不正な日付（NaN）かどうかを判定する。
 * 複合条件（||）を名前付き述語関数に切り出し、C2（条件網羅）の組み合わせ爆発を避ける。
 * @param startDateObject 開始日の Date オブジェクト
 * @param finishDateObject 終了日の Date オブジェクト
 * @returns いずれかが不正な日付であれば true
 */
const isEitherDateInvalid = (
    startDateObject: Date,
    finishDateObject: Date,
): boolean =>
    Number.isNaN(startDateObject.getTime()) ||
    Number.isNaN(finishDateObject.getTime());

/**
 * 日付レンジを検証する（日付パース → NaN 判定 → diff<0 判定 → 上限判定）。
 *
 * router.ts（HTTP）と cli.ts（CLI）に別実装で重複していた検証手続きを集約する。
 * 判定の分岐条件・順序は両実装と一致させ、エラー文言は呼び出し側で付与する。
 * @param startDate - 開始日（YYYY-MM-DD 形式の文字列）
 * @param finishDate - 終了日（YYYY-MM-DD 形式の文字列）
 * @param maxDays - 許容する日付レンジの上限日数
 * @returns 検証結果（成功、または失敗理由）
 */
export const validateDateRange = (
    startDate: string,
    finishDate: string,
    maxDays: number,
): DateRangeValidationResult => {
    const startDateObject = new Date(startDate);
    const finishDateObject = new Date(finishDate);
    if (isEitherDateInvalid(startDateObject, finishDateObject)) {
        return { valid: false, reason: 'invalid-date' };
    }

    const diffMs = finishDateObject.getTime() - startDateObject.getTime();
    if (diffMs < 0) {
        return { valid: false, reason: 'negative-range' };
    }

    if (diffMs >= (maxDays + 1) * MS_PER_DAY) {
        return { valid: false, reason: 'range-too-large' };
    }

    return { valid: true };
};

/**
 * 妥当な raceType 一覧を示すメッセージ（`Valid values: ...`）を返す。
 * cli.ts と router.ts に重複していた文言を集約する（文言は維持）。
 * @returns `Valid values: jra, nar, ...` 形式のメッセージ
 */
export const validRaceTypesMessage = (): string =>
    `Valid values: ${Object.values(RaceType).join(', ')}`;

/**
 * 日付レンジ検証エラー理由ごとのエラーメッセージを返す。
 * cli.ts（CLI）と router.ts（HTTP）で別々の文言だったものを集約する。
 * @param reason - 日付レンジ検証エラーの理由
 * @param maxDays - 許容される最大日数（range-too-large のメッセージ組み立てに使用）
 * @returns 対応するエラーメッセージ
 */
export const dateRangeErrorMessage = (
    reason: DateRangeValidationReason,
    maxDays: number,
): string => {
    const messageByReason: Record<DateRangeValidationReason, string> = {
        'invalid-date':
            'startDate and finishDate must be valid YYYY-MM-DD dates',
        'negative-range': 'finishDate must be the same or after startDate',
        'range-too-large': `Range too large: finishDate - startDate must be ${maxDays} days or less`,
    };
    return messageByReason[reason];
};
