/**
 * 配列を指定サイズごとに分割する。
 * @remarks
 * `processInChunks`（並列実行・チャンク単位の成功/失敗集計）とは異なり、
 * 単純な分割のみを行う。1回のバインド変数上限を超える恐れがある
 * INSERT VALUES（例: 1レースあたり最大9選手 × 1チャンクあたり最大12レース分の
 * race_player行）を、呼び出し元が逐次 await するループの中で使う想定。
 * @param items - 分割対象の配列
 * @param size - 1チャンクの最大件数
 * @returns 分割されたチャンクの配列
 */
export const chunkArray = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};
