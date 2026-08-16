/**
 * 指定ミリ秒だけ待機する（リトライ間の指数バックオフ等で使用）
 * @param ms 待機時間（ミリ秒）
 * @returns 待機完了時に解決するPromise
 */
export const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
