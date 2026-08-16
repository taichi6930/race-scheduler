/**
 * items を concurrency 件ずつのチャンクに分けて並列実行し、チャンク間で delayMs 待機する。
 * 外部 API（Google Calendar 等）のレート制限に対応するためのヘルパー。
 * 各アイテムの settled 結果を onResult に渡す（集計は呼び出し側が行う）。
 *
 * googleCalendarRepository の upsert / cleanseStaleEvents で重複していた
 * 「chunkSize 分割 → Promise.allSettled → setTimeout 待機 → 結果集計」ループを共通化する。
 * @param items - 処理対象の配列
 * @param options - concurrency（同時実行数）と delayMs（チャンク間待機ミリ秒）
 * @param options.concurrency - 同時実行数（チャンクサイズ）
 * @param options.delayMs - チャンク間の待機ミリ秒
 * @param task - 1 アイテムを処理する非同期関数
 * @param onResult - 各アイテムの settled 結果を受け取るコールバック
 */
export const runRateLimited = async <T, R>(
    items: readonly T[],
    options: { concurrency: number; delayMs: number },
    task: (item: T) => Promise<R>,
    onResult: (result: PromiseSettledResult<R>, item: T) => void,
): Promise<void> => {
    const { concurrency, delayMs } = options;
    for (let index = 0; index < items.length; index += concurrency) {
        const chunk = items.slice(
            index,
            Math.min(index + concurrency, items.length),
        );
        const results = await Promise.allSettled(
            chunk.map((item) => task(item)),
        );
        // チャンク間でレート制限を避けるため待機（最終チャンクは不要）
        if (index + concurrency < items.length) {
            await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
        for (const [index, settledResult] of results.entries()) {
            onResult(settledResult, chunk[index]);
        }
    }
};
