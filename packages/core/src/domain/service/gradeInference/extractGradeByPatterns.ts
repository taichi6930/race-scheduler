import { normalizeToHalfWidth } from '../../../utilities/format';

/**
 * テキストからグレードを抽出する共通ヘルパー。
 *
 * patterns は先頭から順に評価し、最初にマッチしたグレードを返す
 * （判定順序が結果に影響するため、呼び出し側は判定順序を厳守すること）。
 * どのパターンにもマッチしない場合は fallback を返す。
 * @param text - 判定対象の文字列
 * @param patterns - `[正規表現, グレード]` の順序付きリスト
 * @param fallback - どのパターンにもマッチしないときの返り値
 * @returns 最初にマッチしたグレード、なければ fallback
 */
export const extractGradeByPatterns = <F>(
    text: string,
    patterns: readonly (readonly [RegExp, string])[],
    fallback: F,
): string | F => {
    const normalized = normalizeToHalfWidth(text);
    for (const [pattern, grade] of patterns) {
        if (pattern.test(normalized)) return grade;
    }
    return fallback;
};
