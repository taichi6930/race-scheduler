/**
 * カンマ区切り文字列を分割し、各要素を trim して空要素を除いた配列を返す共通ユーティリティ。
 *
 * 各所に散在していた `value.split(',').map((v) => v.trim()).filter((v) => v.length > 0)`
 * を 1 箇所に集約する。split → trim → 空除去 と完全一致する挙動のみを提供する。
 * @param value - カンマ区切り文字列
 * @returns trim 済みで空文字を除いた要素の配列
 */
export const splitCsv = (value: string): string[] =>
    value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
