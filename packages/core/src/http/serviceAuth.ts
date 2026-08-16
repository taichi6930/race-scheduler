import { appLogger } from '../utilities/appLogger';
import { EnvStore } from '../utilities/platform/envStore';
import { timingSafeEqualString } from '../utilities/timingSafeEqual';

/** サービス間認証トークンを載せる HTTP ヘッダー名 */
export const SERVICE_AUTH_HEADER = 'X-Service-Auth-Token';

/**
 * 提示されたサービス間認証トークンが正当かを判定する。
 *
 * フェイルクローズ: 期待値が未設定（デプロイ漏れ・環境変数設定漏れ）の場合は
 * 「誰でも通る」ではなく「誰も通らない」に倒す（SECURITY-15）。
 * ローテーション中は旧トークンも受理する（service-auth-design.md §2.5 / §8.1）。
 * @param presentedToken - リクエストヘッダから取り出した値（無ければ null）
 * @param expectedToken - 現行の SERVICE_AUTH_TOKEN
 * @param previousToken - ローテーション中のみ設定される SERVICE_AUTH_TOKEN_PREVIOUS
 * @returns 正当なら true
 */
export const verifyServiceAuthToken = async (
    presentedToken: string | null,
    expectedToken: string | undefined,
    previousToken?: string | undefined,
): Promise<boolean> => {
    if (presentedToken === null) return false;
    if (presentedToken === '') return false;

    if (expectedToken) {
        const matchesCurrent = await timingSafeEqualString(
            presentedToken,
            expectedToken,
        );
        if (matchesCurrent) return true;
    }

    if (!previousToken) return false;
    return timingSafeEqualString(presentedToken, previousToken);
};

/** 認証免除の理由（レビュー時に妥当性を判断できるよう理由を型で強制する） */
export type ServiceAuthExemptReason =
    | 'front-public' // ブラウザ（front）が呼ぶため秘密を持たせられない
    | 'monitoring' // 監視・ヘルスチェック
    | 'static-docs' // 静的なドキュメント応答
    | 'cors-preflight' // OPTIONS プリフライト
    | 'has-own-auth' // 別の認証機構を既に持つ（不特定多数からの到達を前提としない）
    | 'admin-own-auth' // 別の認証機構(X-Admin-Token)を持つが、ブラウザから不特定多数が
    // 到達しうるため`has-own-auth`とは異なりレート制限は外さない（feature-flag-design.md）
    | 'pending-user-auth'; // ユーザー単位の認可へ移行予定（push-ownership-design.md）

export interface ServiceAuthExemptRoute {
    readonly method: string;
    readonly path: string;
    readonly reason: ServiceAuthExemptReason;
}

/**
 * リクエストの method/path が認証免除ルートに該当するかを判定する。
 * @param method - リクエストの HTTP メソッド
 * @param path - リクエストのパス
 * @param exemptRoutes - 認証を免除するルート一覧
 * @returns 免除対象なら true
 */
export const isExempt = (
    method: string,
    path: string,
    exemptRoutes: readonly ServiceAuthExemptRoute[],
): boolean =>
    exemptRoutes.some(
        (route) =>
            route.method === method &&
            (route.path === path || route.path === '*'),
    );

/**
 * サービス間認証トークンを実行環境から読み取る。
 *
 * Worker 上では EnvStore、GitHub Actions 上の CLI（batch）では process.env から読む。
 * `packages/batch/src/types.ts` の requireEnv と同じフォールバック方針。
 * @returns トークン。設定されていなければ undefined
 */
export const readServiceAuthToken = (): string | undefined => {
    try {
        return (
            EnvStore.env.SERVICE_AUTH_TOKEN ?? process.env.SERVICE_AUTH_TOKEN
        );
    } catch {
        // EnvStore が未初期化（CLI モード）: process.env から読み取る
        return process.env.SERVICE_AUTH_TOKEN;
    }
};

/**
 * 既存のヘッダにサービス間認証トークンを付与する。
 *
 * トークンが読めない場合はヘッダを付けずに返し、警告ログを出す
 * （呼び先が 401 を返すため、握り潰しにはならない）。
 * @param headers - 元のヘッダ
 * @returns トークン付与後のヘッダ
 */
export const withServiceAuthHeader = (
    headers?: Record<string, string>,
): Record<string, string> => {
    const token = readServiceAuthToken();
    if (!token) {
        appLogger.warn(
            'SERVICE_AUTH_TOKEN is not set; request will be sent without service auth header',
        );
        return { ...headers };
    }
    return { ...headers, [SERVICE_AUTH_HEADER]: token };
};
