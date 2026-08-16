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
