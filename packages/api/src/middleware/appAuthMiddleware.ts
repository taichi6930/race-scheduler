/**
 * front招待制クローズド化に伴う認可ミドルウェア。
 * @remarks
 * 既存の `requireServiceAuth`（サービス間認証、`core`）はWorker間の
 * 内部呼び出し専用の二値（免除/必須）判定だったが、front全体をログイン必須に
 * する今回の変更では、同じGETエンドポイントが
 * 「他Workerからのサービス間呼び出し」と「frontブラウザからの閲覧」の
 * 両方から呼ばれる（例: `GET /race` は calendar Worker と front の両方が呼ぶ）。
 * そのため単純な置き換えではなく、ルートごとに4種類の方針
 * （public/service-only/session-only/service-or-session）を持たせた
 * 専用ミドルウェアをこのファイルで新設する。
 */
import {
    type CloudFlareEnv,
    DI_TOKENS,
    runWithCurrentUserId,
    runWithInternalServiceCall,
    verifyServiceAuthToken,
} from '@race-schedule/core';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { container } from 'tsyringe';

import type { IAuthRepository } from '../repository/interface/IAuthRepository';

const SERVICE_AUTH_HEADER = 'X-Service-Auth-Token';
const SESSION_AUTH_HEADER = 'Authorization';
const SESSION_BEARER_PREFIX = 'Bearer ';

/** セッションの有効期限延長幅（スライディングウィンドウ）。7日間操作が無ければ失効する。 */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AppAuthPolicy =
    | 'public' // 認証不要（ヘルスチェック・CORS preflight・パスキー登録/ログイン自体等）
    | 'service-only' // サービス間認証のみ（他Workerからの内部呼び出し専用エンドポイント）
    | 'session-only' // セッション認証のみ（frontの書き込み等、他Workerが呼ばないエンドポイント）
    | 'service-or-session'; // どちらか一方があれば通す（frontの閲覧 + 他Workerからの読み取り）

export interface AppAuthRoute {
    readonly method: string;
    readonly path: string;
    readonly policy: AppAuthPolicy;
}

/**
 * ルート定義のpathが、実際のリクエストpathにマッチするかどうかを判定する。
 * 完全一致・`*`（全パス）に加え、`/auth/credential/*` のような接頭辞ワイルドカード
 * （パスパラメータを含む動的ルート向け）にも対応する。
 * @param routePath - ルート定義のpath
 * @param requestPath - 実際のリクエストpath
 */
const isExactOrGlobalMatch = (
    routePath: string,
    requestPath: string,
): boolean => routePath === requestPath || routePath === '*';

const matchesPath = (routePath: string, requestPath: string): boolean => {
    if (isExactOrGlobalMatch(routePath, requestPath)) return true;
    if (routePath.endsWith('/*')) {
        return requestPath.startsWith(routePath.slice(0, -1));
    }
    return false;
};

/**
 * リクエストのmethod/pathに対応する方針を解決する。
 * 明示的に列挙されていないルートは `service-only` を既定にする
 * （deny-by-default。新しいルートを追加したときに認証を書き忘れても
 * 保護される側に倒れる、既存のrequireServiceAuthと同じ思想）。
 * @param method - リクエストのHTTPメソッド
 * @param path - リクエストのパス
 * @param routes - ルート方針一覧
 */
const resolvePolicy = (
    method: string,
    path: string,
    routes: readonly AppAuthRoute[],
): AppAuthPolicy => {
    const matched = routes.find(
        (route) => route.method === method && matchesPath(route.path, path),
    );
    return matched?.policy ?? 'service-only';
};

/**
 * 提示されたサービス間認証トークンが正当かどうかを判定する。
 * @param c - Honoコンテキスト
 */
const checkServiceAuth = async (c: Context): Promise<boolean> => {
    const presentedToken = c.req.raw.headers.get(SERVICE_AUTH_HEADER);
    const env = (c.env ?? {}) as CloudFlareEnv;
    return verifyServiceAuthToken(
        presentedToken,
        env.SERVICE_AUTH_TOKEN ?? process.env.SERVICE_AUTH_TOKEN,
        env.SERVICE_AUTH_TOKEN_PREVIOUS ??
            process.env.SERVICE_AUTH_TOKEN_PREVIOUS,
    );
};

/**
 * `Authorization: Bearer <token>` ヘッダーからセッショントークンを取り出す。
 * @param c - Honoコンテキスト
 */
const extractSessionToken = (c: Context): string | null => {
    const header = c.req.raw.headers.get(SESSION_AUTH_HEADER);
    if (!header?.startsWith(SESSION_BEARER_PREFIX)) return null;
    const token = header.slice(SESSION_BEARER_PREFIX.length).trim();
    return token.length > 0 ? token : null;
};

/**
 * 提示されたセッショントークンを検証し、有効なら7日後へ延長する
 * （スライディングウィンドウ）。
 * @param c - Honoコンテキスト
 */
const checkSessionAuth = async (c: Context): Promise<string | null> => {
    const token = extractSessionToken(c);
    if (!token) return null;

    const authRepository = container.resolve<IAuthRepository>(
        DI_TOKENS.AuthRepository,
    );
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const record = await authRepository.validateAndRefreshSession(
        token,
        newExpiresAt,
    );
    return record?.userId ?? null;
};

/**
 * 方針がサービス間認証を許容するかどうか（service-only/service-or-session）。
 * @param policy
 */
const acceptsServiceAuth = (policy: AppAuthPolicy): boolean =>
    policy === 'service-only' || policy === 'service-or-session';

/**
 * 方針がセッション認証を許容するかどうか（session-only/service-or-session）。
 * @param policy
 */
const acceptsSessionAuth = (policy: AppAuthPolicy): boolean =>
    policy === 'session-only' || policy === 'service-or-session';

/**
 * front招待制クローズド化に対応した認可ミドルウェアを生成する。
 * `ensureDIInitialized` は本ミドルウェア自身が先頭で呼ぶ（`session-only`/
 * `service-or-session` の判定にDBアクセスが必要なため、既存のper-handler
 * 初期化パターンに合わせてミドルウェア側でも自己完結させる）。
 * @param routes - ルート方針一覧
 * @param ensureDIInitialized - DI初期化関数（router.tsのものを注入、循環import回避）
 */
export const requireAppAuth = (
    routes: readonly AppAuthRoute[],
    ensureDIInitialized: (env: CloudFlareEnv) => void,
): MiddlewareHandler => {
    return async (c: Context, next: Next) => {
        const policy = resolvePolicy(c.req.method, c.req.path, routes);
        if (policy === 'public') {
            await next();
            return;
        }

        ensureDIInitialized(c.env as CloudFlareEnv);

        if (acceptsServiceAuth(policy)) {
            const serviceAuthOk = await checkServiceAuth(c);
            if (serviceAuthOk) {
                await runWithInternalServiceCall(true, next);
                return;
            }
        }

        if (acceptsSessionAuth(policy)) {
            const userId = await checkSessionAuth(c);
            if (userId) {
                await runWithCurrentUserId(userId, next);
                return;
            }
        }

        return c.json(
            { status: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' },
            401,
        );
    };
};
