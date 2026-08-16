/**
 * 日本時間（JST）での日付操作ユーティリティ
 *
 * このモジュールは、JavaScript標準のDateオブジェクトとIntl APIを活用して、
 * Cloudflare Workers、ブラウザ、Node.jsなど、あらゆる環境で一貫した
 * 日本時間の扱いを提供します。
 *
 * ## 設計方針
 * - Dateオブジェクトは常にUTCとして内部保存
 * - Intl.DateTimeFormatでJST表示・取得を実現
 * - タイムゾーンオフセットの手動計算を避ける
 * - 環境のタイムゾーン設定に依存しない
 *
 * ## ベストプラクティス
 * - データベースには常にUTCで保存
 * - 表示時のみJSTに変換
 * - DST（夏時間）の心配不要（日本にはDSTが存在しない）
 */

/**
 * 日本のタイムゾーン識別子
 */
export const JST_TIMEZONE = 'Asia/Tokyo';

/** JST と UTC のオフセット（ミリ秒） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 1日あたりのミリ秒数（日付レンジ上限チェック等で使用） */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Date または 日付文字列を Date オブジェクトに変換（統一的に取り扱うため）
 * @param datetime Date オブジェクトまたは ISO 8601 形式の文字列
 * @returns Date オブジェクト
 */
const toDate = (datetime: Date | string): Date =>
    typeof datetime === 'string' ? new Date(datetime) : datetime;

/**
 * JST 基準で `Date` オブジェクトを返す（内部処理用）
 *
 * 入力の瞬間（epoch）そのものは変えず、Date/文字列を統一的に Date へ正規化しつつ、
 * 無効な日時であれば例外を投げるバリデーションを行う。
 * @param datetime Date オブジェクトまたは日付文字列
 * @returns 正規化された Date オブジェクト
 * @throws {TypeError} datetime が無効な日時の場合
 */
export const formatJstDatetime = (datetime: Date | string): Date => {
    const d = toDate(datetime);
    // 入力が無効な Date の場合、エラーを投げる
    if (Number.isNaN(d.getTime())) {
        throw new TypeError(`Invalid datetime value: ${String(datetime)}`);
    }
    const shifted = new Date(d.getTime() + JST_OFFSET_MS);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    const hours = String(shifted.getUTCHours()).padStart(2, '0');
    const mins = String(shifted.getUTCMinutes()).padStart(2, '0');
    const secs = String(shifted.getUTCSeconds()).padStart(2, '0');
    const result = new Date(
        `${year}-${month}-${day}T${hours}:${mins}:${secs}+09:00`,
    );
    if (Number.isNaN(result.getTime())) {
        throw new TypeError(`Failed to format datetime: ${String(datetime)}`);
    }
    return result;
};

/**
 * 日本時間（JST）で日付を作成
 *
 * ISO 8601形式の文字列から、JSTの日時として解釈されるDateオブジェクトを作成します。
 * 内部的にはUTCで保存されますが、指定した日時がJST基準であることを保証します。
 * @param year 年
 * @param month 月（1-12）
 * @param day 日
 * @param hour 時（0-23）デフォルト0
 * @param minute 分（0-59）デフォルト0
 * @param second 秒（0-59）デフォルト0
 * @returns JST時刻のDateオブジェクト（内部はUTC）
 * @example
 * ```typescript
 * // JST 2024-04-26 00:00:00を作成
 * const date = createJstDate(2024, 4, 26);
 * appLogger.info(date.toISOString()); // "2024-04-25T15:00:00.000Z" (UTC)
 * appLogger.info(formatJstDate(date)); // "2024/4/26 0:00:00" (JST表示)
 * ```
 */
export function createJstDate(
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
): Date {
    // ISO 8601形式の文字列を作成
    // タイムゾーンオフセット+09:00を明示的に指定
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+09:00`;
    return new Date(dateString);
}

/**
 * DateオブジェクトからJSTの特定の構成要素（年/月/日/時/分/秒）を取得する共通ヘルパー。
 *
 * `getJstYear`/`getJstMonth`/`getJstDate`/`getJstHours`/`getJstMinutes`/`getJstSeconds` は
 * いずれも `toLocaleString('ja-JP', { timeZone: JST_TIMEZONE, ... })` + `Number.parseInt` という
 * 同一パターンをオプションだけ変えて繰り返していたため、本ヘルパーへ集約した（refactor#114）。
 * @param date Dateオブジェクト
 * @param options 取得したい構成要素を指定する Intl.DateTimeFormatOptions（`timeZone` は本関数が付与する）
 * @returns 指定した構成要素の数値
 */
function getJstPart(date: Date, options: Intl.DateTimeFormatOptions): number {
    return Number.parseInt(
        date.toLocaleString('ja-JP', {
            timeZone: JST_TIMEZONE,
            ...options,
        }),
    );
}

/**
 * DateオブジェクトからJST（日本時間）での年を取得
 * @param date Dateオブジェクト
 * @returns JST年
 * @example
 * ```typescript
 * const date = new Date('2024-04-25T15:00:00Z'); // UTC
 * appLogger.info(getJstYear(date)); // 2024 (JSTでは2024-04-26)
 * ```
 */
export function getJstYear(date: Date): number {
    return getJstPart(date, { year: 'numeric' });
}

/**
 * DateオブジェクトからJST（日本時間）での月を取得
 * @param date Dateオブジェクト
 * @returns JST月（1-12）
 */
export function getJstMonth(date: Date): number {
    return getJstPart(date, { month: 'numeric' });
}

/**
 * DateオブジェクトからJST（日本時間）での日を取得
 * @param date Dateオブジェクト
 * @returns JST日（1-31）
 */
export function getJstDate(date: Date): number {
    return getJstPart(date, { day: 'numeric' });
}

/**
 * DateオブジェクトからJST（日本時間）での時を取得
 * @param date Dateオブジェクト
 * @returns JST時（0-23）
 */
export function getJstHours(date: Date): number {
    return getJstPart(date, { hour: 'numeric', hour12: false });
}

/**
 * DateオブジェクトからJST（日本時間）での分を取得
 * @param date Dateオブジェクト
 * @returns JST分（0-59）
 */
export function getJstMinutes(date: Date): number {
    return getJstPart(date, { minute: 'numeric' });
}

/**
 * DateオブジェクトからJST（日本時間）での秒を取得
 * @param date Dateオブジェクト
 * @returns JST秒（0-59）
 */
export function getJstSeconds(date: Date): number {
    return getJstPart(date, { second: 'numeric' });
}

/**
 * toJstISOString 専用の Intl.DateTimeFormat インスタンス。
 * `formatToParts` は年月日時分秒をまとめて1回のIntl呼び出しで取得できるため、
 * getJstYear〜getJstSeconds を個別に6回呼び出す（＝Intl.DateTimeFormatの生成・
 * フォーマットを6回行う）よりも大幅に軽量になる（PERF-091）。
 * モジュールスコープで1度だけ生成し、呼び出しのたびに再生成しない。
 */
const JST_ISO_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: JST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

/**
 * DateオブジェクトをJST ISO 8601形式の文字列に変換
 *
 * `getJstYear`〜`getJstSeconds` を個別に呼び出す代わりに、`formatToParts` で
 * 年月日時分秒を1回のIntl呼び出しでまとめて取得する（PERF-091）。
 * `getJstYear` 等の個別関数のシグネチャ・挙動、および本関数の戻り値の文字列表現は
 * 変更していない。
 * @param date Dateオブジェクト
 * @returns JST ISO 8601形式の文字列（例: "2024-04-26T00:00:00+09:00"）
 * @example
 * ```typescript
 * const date = createJstDate(2024, 4, 26);
 * appLogger.info(toJstISOString(date)); // "2024-04-26T00:00:00+09:00"
 * ```
 */
export function toJstISOString(date: Date): string {
    const parts = JST_ISO_PARTS_FORMATTER.formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
        values[part.type] = part.value;
    }

    // 一部のICU実装では hour12:false 指定時に深夜0時が "24" として返る既知の
    // 挙動差があるため、"00" に正規化しておく（既存の getJstHours ベースの
    // 実装ではこの問題は発生しないため、置換後も同じ結果になるよう防御する）。
    const hour = values.hour === '24' ? '00' : values.hour;

    return `${values.year}-${values.month}-${values.day}T${hour}:${values.minute}:${values.second}+09:00`;
}
