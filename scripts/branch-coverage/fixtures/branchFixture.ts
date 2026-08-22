/**
 * @file branchInstrumentPlugin.test.ts が使う固定フィクスチャ。
 * if/else と && の2種類の分岐を持つだけの最小関数。
 * @param a - 分岐条件1
 * @param b - 分岐条件2
 * @returns 両方trueなら'both'、それ以外は'not-both'
 */
export function classify(a: boolean, b: boolean): string {
    if (a && b) {
        return 'both';
    }
    return 'not-both';
}
