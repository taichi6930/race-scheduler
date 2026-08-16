import type { Context, MiddlewareHandler, Next } from 'hono';

import { appLogger } from '../utilities/appLogger';
import type { CloudFlareEnv } from '../utilities/platform/cloudFlareEnv';
import { runWithInternalServiceCall } from '../utilities/requestContext';
import {
    isExempt,
    SERVICE_AUTH_HEADER,
    type ServiceAuthExemptRoute,
    verifyServiceAuthToken,
} from './serviceAuth';

/**
 * 認証拒否をログに記録する（提示されたトークン値は絶対に含めない、SECURITY-03）。
 * @param c - Hono コンテキスト
 */
const logAuthRejection = (c: Context): void => {
    appLogger.warn('Service auth rejected request', {
        method: c.req.method,
        path: c.req.path,
        ip: c.req.header('CF-Connecting-IP') ?? undefined,
    });
};

/**
 * リクエストが正当なサービス間認証トークンを提示しているかを判定する。
 * @param c - Hono コンテキスト
 * @returns 正当なら true
 */
const isAuthorized = async (c: Context): Promise<boolean> => {
    const presentedToken = c.req.raw.headers.get(SERVICE_AUTH_HEADER);
    // c.env は Workers 本番では常に定義されるが、bindings を渡さずに
    // app.request(...) を呼ぶテスト等では undefined になりうるため、
    // フェイルクローズを保つ目的で空オブジェクトへフォールバックする。
    const env = (c.env ?? {}) as CloudFlareEnv;
    const expectedToken =
        env.SERVICE_AUTH_TOKEN ?? process.env.SERVICE_AUTH_TOKEN;
    const previousToken =
        env.SERVICE_AUTH_TOKEN_PREVIOUS ??
        process.env.SERVICE_AUTH_TOKEN_PREVIOUS;
    return verifyServiceAuthToken(presentedToken, expectedToken, previousToken);
};

/**
 * サービス間認証を要求する Hono ミドルウェアを生成する。
 *
 * deny-by-default: exemptRoutes に列挙されたルート以外はすべて認証必須。
 * 新しいルートを追加したときに認証を書き忘れても保護される側に倒れる。
 * @param exemptRoutes - 認証を免除するルート（理由付き）
 * @returns Hono ミドルウェア
 */
export const requireServiceAuth = (
    exemptRoutes: readonly ServiceAuthExemptRoute[],
): MiddlewareHandler => {
    return async (c: Context, next: Next) => {
        if (isExempt(c.req.method, c.req.path, exemptRoutes)) {
            await next();
            return;
        }

        if (await isAuthorized(c)) {
            // サービス間認証済みの呼び出しであることをこのリクエスト処理全体
            // （usecase/repositoryのthrowを含む）に紐付ける。500応答へエラー
            // 詳細を含めてよいかどうかの判定（resolveInternalErrorMessage）に使う。
            await runWithInternalServiceCall(true, next);
            return;
        }

        logAuthRejection(c);
        return c.json(
            { status: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' },
            401,
        );
    };
};
