/**
 * ID 組み立て時のゼロ埋め書式定数。
 * placeId / raceId のセグメント（開催場コード・レース番号）は 2 桁ゼロ埋めで連結する。
 * 各所に直書きされていた `padStart(2, '0')` の桁数・パディング文字をここに集約する。
 */

/** ID セグメントのゼロ埋め桁数（開催場コード・レース番号ともに 2 桁） */
export const ID_SEGMENT_PAD_WIDTH = 2;

/** ID セグメントのゼロ埋めに使う文字 */
export const ID_PAD_CHAR = '0';

/**
 * placeId / raceId 末尾に含まれる日付文字列（YYYYMMDD）の桁数。
 * parsePlaceId で ID から日付部分を切り出す際に使用する。
 */
export const DATE_STRING_LENGTH = 8;

/** 日付文字列（YYYYMMDD）内の 年（YYYY）の桁数 */
export const DATE_YEAR_LENGTH = 4;

/** 日付文字列（YYYYMMDD）内の 月（MM）の桁数 */
export const DATE_MONTH_LENGTH = 2;

/** 日付文字列（YYYYMMDD）内の 日（DD）の桁数 */
export const DATE_DAY_LENGTH = 2;
