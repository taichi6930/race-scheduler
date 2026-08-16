/**
 * UAT smoke テスト共通ヘルパー: タイムアウト付き fetch。
 * 実際にデプロイされた Worker へ本物の HTTP リクエストを送るため、
 * ネットワーク不調時にテストが既定の 5 分タイムアウトまで無限に待たないよう、
 * 短いタイムアウトで確実に fail させる。
 * @param url リクエスト先URL
 * @param init fetch の RequestInit
 * @param timeoutMs タイムアウト（ミリ秒、既定 10 秒）
 */
export const fetchWithTimeout = async (
    url: string,
    init: RequestInit = {},
    timeoutMs = 10_000,
): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};
