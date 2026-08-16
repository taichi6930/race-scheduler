/**
 * D1 のバインド変数上限に基づく upsert チャンクサイズ算出の共通ヘルパー。
 *
 * race/place/player の各リポジトリが個別に持っていた `D1_MAX_BIND_VARS` 定数と
 * `Math.floor(D1_MAX_BIND_VARS / paramsPerRow)` という同一の算出式を集約する。
 */

/** D1 の 1 クエリあたりの SQL バインド変数上限 */
export const D1_MAX_BIND_VARS = 100;

/**
 * D1 のバインド変数上限を 1 行あたりのパラメータ数で割り、upsert のチャンクサイズを算出する。
 * @param paramsPerRow - 1 行あたりのバインドパラメータ数（対象テーブルの columns 数に対応）
 * @returns チャンクサイズ（`floor(D1_MAX_BIND_VARS / paramsPerRow)`）
 */
export const resolveUpsertChunkSize = (paramsPerRow: number): number =>
    Math.floor(D1_MAX_BIND_VARS / paramsPerRow);
