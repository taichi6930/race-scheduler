/**
 * @file scripts/ 配下で共有する軽量な型ガード。
 *
 * `typeof value === 'string'` 等を呼び出し側に直接書かせず、名前付き述語関数として
 * 切り出す（anti-slop/no-runtime-typeof: allowInTypeGuards はこの形の関数のみを
 * 許容するため）。check-audit-allowlist.ts / check-deploy-working-dirs.ts /
 * commitPrLookup.ts / generateReleaseSummary.ts で共有する。
 */

/**
 * 値が文字列かどうかを判定する。
 * @param value - 判定対象の値
 * @returns 文字列であれば true
 */
export const isStringValue = (value: unknown): value is string =>
    typeof value === 'string';

/**
 * 値が null ではないオブジェクトかどうかを判定する。
 * @param value - 判定対象の値
 * @returns null ではないオブジェクトであれば true
 */
export const isNonNullObject = (value: unknown): value is object =>
    typeof value === 'object' && value !== null;
