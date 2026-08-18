/**
 * HTML文字列として有効かチェック
 * - 空ではない
 * - 文字列型である
 * - 空白のみでない
 * @param value - チェック対象の値
 * @returns 有効な HTML 文字列の場合 true
 */
export function isValidHtmlString(value: unknown): value is string {
    return (
        typeof value === 'string' && value.length > 0 && value.trim().length > 0
    );
}

/**
 * 値が文字列かどうかを判定する型ガード。
 * `typeof value === 'string'` を呼び出し側へ直接書かせず、名前付き述語関数として
 * 共有する（anti-slop/no-runtime-typeof の allowInTypeGuards はこの形の関数のみを
 * 許容するため）。
 * @param value - 判定対象の値
 * @returns 文字列であれば true
 */
export function isStringValue(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * 値が null ではないオブジェクトかどうかを判定する型ガード。
 * @param value - 判定対象の値
 * @returns null ではないオブジェクトであれば true
 */
export function isNonNullObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}
