/**
 * fetch クエリの日付レンジが極端に広い場合の防御的上限（PERF-039/PERF-040）。
 * place/player/race の各 repository.fetch で同じ値を個別ハードコードしていたため、
 * 「同じ値である」というコメント上の不変条件をコードでも保証できるよう集約した。
 */
export const FETCH_ROW_LIMIT = 10_000;

/**
 * 絞り込みリストが1件以上存在するかどうかを判定する。
 * fetch の WHERE 句組み立てで複合条件（&&）を三項演算子に埋め込むと
 * local/no-compound-condition に抵触するため、単独の述語関数として切り出す。
 * `raceSqlHelpers.ts`（race）と `placeRepository.ts`（place）で同一実装が
 * 重複していたため、共通ヘルパーとして統合した。
 * @param list - 絞り込みリスト（undefined / 空配列可）
 */
export const hasFilterValues = (
    list: readonly string[] | undefined,
): list is readonly string[] => list !== undefined && list.length > 0;
