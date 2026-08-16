/**
 * 文字列整形（レース名の正規化など）で使う置換ルール。
 */
export interface ReplaceRule {
    pattern: RegExp;
    replacement: string;
}

/**
 * NAR（`processNarRaceName`）と海外（`processOverseasRaceName`）で共通の
 * 「ステークス→S」「カップ→C」置換ペア。
 * @remarks
 * 呼び出し側は `pattern` に必要な正規表現フラグが異なる
 * （NAR は `replaceAll` 前提で `g` フラグ必須、海外は `firstMatchOnly` 前提で
 * `g` フラグを付けない）ため、`ReplaceRule[]` そのものではなく素材（`needle`/`replacement`）
 * を共有し、各呼び出し側で用途に応じた `RegExp` を組み立てる。
 */
export const STAKES_CUP_ABBREVIATIONS: {
    needle: string;
    replacement: string;
}[] = [
    { needle: 'ステークス', replacement: 'S' },
    { needle: 'カップ', replacement: 'C' },
];

/**
 * 置換ルールを順次適用する。
 *
 * NAR / 海外のレース名整形で同一実装が重複していたものを共通化したもの。
 * 差分だった「全置換 / 最初の1マッチのみ置換」は `firstMatchOnly` オプションで切り替える。
 * @param name - 対象文字列
 * @param rules - 適用する置換ルール配列
 * @param options - オプション
 * @param options.firstMatchOnly - true なら各ルールで最初の1マッチのみ置換（既定は全置換）。
 *   全置換（既定）では `pattern` に `g` フラグが必要（String.replaceAll の仕様）。
 * @returns 置換後の文字列
 */
export const applyReplaceRules = (
    name: string,
    rules: ReplaceRule[],
    options: { firstMatchOnly?: boolean } = {},
): string => {
    let result = name;
    for (const rule of rules) {
        result = options.firstMatchOnly
            ? result.replace(rule.pattern, () => rule.replacement)
            : result.replaceAll(rule.pattern, () => rule.replacement);
    }
    return result;
};
