import type { ZodType } from 'zod';

import { formatZodIssues } from '../schemas/common';
import { splitCsv } from '../utilities';
import { ValidationError } from '../utilities/validationError';

/**
 * 正規表現リテラルは呼び出しのたびに新規インスタンスが生成されるため、
 * 呼び出し頻度の高いクエリパラメータ変換関数群ではモジュールスコープの
 * 定数へ巻き上げて再生成コストを避ける（PERF-088）。
 */
/** 数値表記（整数・先頭ゼロ以外）判定用 */
const INTEGER_OR_FLOAT_PATTERN = /^-?[1-9]\d*(\.\d+)?$/;
/** 数値表記（0または0始まりの小数）判定用 */
const ZERO_NUMERIC_PATTERN = /^-?0(\.\d+)?$/;
/** YYYY-MM-DD 形式判定用 */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 8601 形式（日時部分含む）判定用 */
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

/**
 * URLSearchParams を正規化してZodスキーマでパースする
 * 日付文字列 -> Date、boolean文字列 -> boolean、などの変換を行う
 * @param schema
 * @param searchParams
 */
export const parseQueryParams = <T>(
    schema: ZodType<T>,
    searchParams: URLSearchParams,
): T => {
    const params = normalizeSearchParams(searchParams);
    const result = schema.safeParse(params);

    if (!result.success) {
        throw new ValidationError(formatZodIssues(result.error.issues), 400);
    }

    return result.data;
};

/**
 * URLSearchParams を通常のオブジェクトに変換し、型を推測する
 * - 日付フォーマット (YYYY-MM-DD) は Date に変換
 * - 'true'/'false' は boolean に変換
 * - カンマ区切り文字列は配列に変換（複数の値がある場合）
 *
 * 従来は「1周目でRecord化 → 2周目で全キーを再走査しカンマ区切りを配列化」という
 * 2パス構成だったが、searchParams の1回の走査のみで完結するよう1パス化した
 * （PERF-087）。カンマ区切りの分割判定は「そのキーが最終的に1回しか出現しなかった場合」
 * のみ行うため、走査中は単一出現のままカンマを含む値を pendingRawValues に保持し、
 * 走査完了後に該当キーだけ分割する（同一キーが複数回出現した場合は、既存実装と同様に
 * 分割を行わない挙動を維持する）。
 * @param searchParams
 */
/* oxlint-disable anti-slop/no-unsafe-dictionary-type -- 呼び出し元のparseQueryParamsが
   直後にZodスキーマでパース・検証するため、この中間表現の時点ではRecord<string, unknown>で正しい */
const normalizeSearchParams = (
    searchParams: URLSearchParams,
): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    // 単一出現のままカンマを含む値を持つキーの生値を保持する（キー単位で高々1件）。
    // 複数回出現するキーになった時点で pending から外れ、以後は分割対象にしない。
    const pendingRawValues = new Map<string, string>();

    for (const [key, rawValue] of searchParams) {
        if (Object.hasOwn(result, key)) {
            // 既に1回以上登場したキー：複数値として配列に追加する（分割候補からは除外）
            pendingRawValues.delete(key);
            const existing = result[key];
            if (Array.isArray(existing)) {
                existing.push(normalizeValue(rawValue));
            } else {
                result[key] = [existing, normalizeValue(rawValue)];
            }
        } else {
            result[key] = normalizeValue(rawValue);
            if (isCommaSeparatedString(rawValue)) {
                pendingRawValues.set(key, rawValue);
            }
        }
    }

    // 単一出現のままカンマ区切りだったキーだけ、配列に変換する
    for (const [key, rawValue] of pendingRawValues) {
        result[key] = splitCsv(rawValue).map((v) => normalizeValue(v));
    }

    return result;
};
/* oxlint-enable anti-slop/no-unsafe-dictionary-type */

/**
 * 文字列がカンマ区切り値かどうかを判定する型ガード。
 * 複合条件（&&）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param value - 判定対象の値
 * @returns カンマを含む文字列なら true
 */
const isCommaSeparatedString = (value: unknown): value is string =>
    typeof value === 'string' && value.includes(',');

/**
 * 文字列が数値表記（整数または浮動小数点、先頭ゼロの単独 0 を含む）かどうかを判定する。
 * 複合条件（||）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param value - 判定対象の文字列
 * @returns 数値として解釈できる表記なら true
 */
const isNumericString = (value: string): boolean =>
    INTEGER_OR_FLOAT_PATTERN.test(value) || ZERO_NUMERIC_PATTERN.test(value);

/**
 * 値を推測して型変換する
 * @param value
 */
// oxlint-disable-next-line anti-slop/no-unknown-returns -- boolean/Date/number/stringのいずれかを推測で返すヒューリスティック。呼び出し元のparseQueryParamsが直後にZodスキーマでパース・検証するため、この時点ではunknownで正しい
const normalizeValue = (value: string): unknown => {
    // boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // 日付（YYYY-MM-DD形式）
    // `new Date('YYYY-MM-DD')` は仕様上UTC深夜0時として解釈されるため、
    // DB側のJST深夜0時基準（date_time列）とは9時間ズレる。
    // 単一日レンジ（startDate === finishDate）でBETWEEN検索が0件になる原因となるため、
    // JST深夜0時として明示的にパースする。
    if (DATE_ONLY_PATTERN.test(value)) {
        const date = new Date(`${value}T00:00:00+09:00`);
        // 無効な日付でなければ返す
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    // ISO 8601 形式の日付
    if (ISO_DATETIME_PATTERN.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    // 数値（整数と浮動小数点）- 先頭が0の場合は文字列として保持
    // 上記の正規表現にマッチする文字列は必ず有効な数値へ変換できるため、
    // Number() の結果が NaN になることはない（追加の NaN ガードは不要）。
    if (isNumericString(value)) {
        return Number(value);
    }

    // デフォルトは文字列のまま
    return value;
};
