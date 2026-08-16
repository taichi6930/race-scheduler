import type { Context, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

/** リクエストボディの上限サイズ（1MB）。 */
const MAX_BODY_SIZE = 1024 * 1024;

/**
 * リクエストボディサイズ制限（1MB）を課す Hono ミドルウェアを生成する（SEC-029）。
 *
 * 過大なリクエストボディによるリソース枯渇・DoS攻撃を防ぐため、全 Worker
 * （api/batch/calendar/scraping）で共通の上限・エラーレスポンス形状を用いる。
 * 上限を超えた場合は `{ status: 413, message: 'Request body exceeds 1MB limit' }`
 * を 413 で返す。
 * @remarks
 * PERF-049: ボディを持たない GET/HEAD/OPTIONS にまで毎回ボディ検査を評価させると
 * 無駄なオーバーヘッドになるため、呼び出し側では `router.use('*', ...)` ではなく
 * `router.on(['POST', 'PUT', 'DELETE'], '*', bodyLimitMiddleware())` のように、
 * ボディを受け取りうる POST/PUT/DELETE のみに絞り込んで登録すること
 * （`securityHeadersMiddleware`・`rateLimitMiddleware` とは異なり `router.use('*', ...)`
 * では登録しない）。
 * @returns Hono ミドルウェア
 */
export const bodyLimitMiddleware = (): MiddlewareHandler => {
    return bodyLimit({
        maxSize: MAX_BODY_SIZE,
        onError: (c: Context) => {
            return c.json(
                {
                    status: 413,
                    message: 'Request body exceeds 1MB limit',
                },
                413,
            );
        },
    });
};
