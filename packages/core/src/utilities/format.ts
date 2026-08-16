/**
 * 日付をフォーマットする
 * @param date - フォーマットする日付
 * @returns ISOフォーマットかつ日本時間（+09:00）の日付文字列
 */
import { getJstDate, getJstMonth } from './dateJst';

const padNumber = (value: number, digit: number): string => {
    return value.toString().padStart(digit, '0');
};

/**
 * JST（日本時間）での月をフォーマットします
 * @param date Dateオブジェクト
 * @param digit パディング桁数
 * @returns フォーマット済みの月（例: "02"）
 */
export const formatMonthDigits = (date: Date, digit: number): string =>
    padNumber(getJstMonth(date), digit);

/**
 * JST（日本時間）での日をフォーマットします
 * @param date Dateオブジェクト
 * @param digit パディング桁数
 * @returns フォーマット済みの日（例: "15"）
 */
export const formatDayDigits = (date: Date, digit: number): string =>
    padNumber(getJstDate(date), digit);

export const toXDigits = (value: number, digit: number): string =>
    padNumber(value, digit);

export const replaceFromCodePoint = (
    input: string,
    searchValue: string | RegExp,
): string => {
    return input.replace(searchValue, (s) =>
        String.fromCodePoint((s.codePointAt(0) ?? 0) - 0xfe_e0),
    );
};

/**
 * 全角英数字・記号（U+FF01-FF5E）にマッチする正規表現。
 * `normalizeToHalfWidth` の呼び出しのたびにリテラルを再生成していたのを、
 * 呼び出し頻度の高いグレード抽出（全raceType）で積み上がらないようモジュールスコープへ巻き上げる
 * （PERF-093）。
 */
const FULL_WIDTH_CHAR_REGEX = /[！-～]/g;

/**
 * 全角英数字・記号を半角へ正規化する
 *
 * `！-～`（U+FF01-FF5E）は全角英数字（０-９Ａ-Ｚａ-ｚ）を包含するため、
 * この 1 回の置換で両方をまとめて半角化できる。
 * @param text - 変換対象の文字列
 * @returns 半角へ正規化した文字列
 */
export const normalizeToHalfWidth = (text: string): string =>
    replaceFromCodePoint(text, FULL_WIDTH_CHAR_REGEX);
