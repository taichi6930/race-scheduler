/**
 * 2 つの文字列が等しいかを、比較時間が内容に依存しない形で判定する。
 *
 * 素朴な `===` は先頭から不一致になった時点で打ち切られるため、
 * 一致した先頭バイト数が実行時間に漏れる（タイミングサイドチャネル）。
 * ここでは両者の SHA-256 ダイジェスト（常に 32 バイト）を取り、
 * 全バイトを XOR で畳み込むことで、長さ・内容のいずれも実行時間に漏らさない。
 * @param a - 比較対象の文字列
 * @param b - 比較対象の文字列
 * @returns 等しければ true
 */
export const timingSafeEqualString = async (
    a: string,
    b: string,
): Promise<boolean> => {
    const encoder = new TextEncoder();
    const [digestA, digestB] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(a)),
        crypto.subtle.digest('SHA-256', encoder.encode(b)),
    ]);
    const bytesA = new Uint8Array(digestA);
    const bytesB = new Uint8Array(digestB);

    let diff = 0;
    for (const [index, byte] of bytesA.entries()) {
        diff |= byte ^ bytesB[index];
    }
    return diff === 0;
};
