import type { RateLimit } from '@cloudflare/workers-types';
import type { Context, MiddlewareHandler, Next } from 'hono';

import { appLogger } from '../utilities/appLogger';
import type { CloudFlareEnv } from '../utilities/platform/cloudFlareEnv';
import type {
    ServiceAuthExemptReason,
    ServiceAuthExemptRoute,
} from './serviceAuth';

/**
 * サービス間認証（`requireServiceAuth`）を免除されているルートの理由のうち、
 * レート制限の対象としても除外すべきもの（SEC-011）。
 *
 * - `cors-preflight`: OPTIONS プリフライトは実処理を伴わず、ブロックすると
 *   ブラウザからの正当なリクエストが軒並み失敗する。
 * - `monitoring`: `/health` は外形監視（uptime-check.yml 等）が高頻度で叩くため、
 *   レート制限の対象にすると監視自体が誤検知で止まる。
 * - `has-own-auth`: `/push/dispatch` は別途ディスパッチトークンで保護済みで、
 *   不特定多数からの到達を前提としないため対象外。
 *
 * それ以外（`front-public`/`static-docs`/`pending-user-auth`/`admin-own-auth`）は、
 * サービス間認証で保護されない＝不特定多数から到達可能なエンドポイントのため、
 * レート制限の主対象とする。`admin-own-auth`（`/admin/flags/api`）は`has-own-auth`と
 * 同様に別のトークンで保護されているが、`/push/dispatch`と異なりブラウザから
 * 不特定多数が到達しうる（=トークンの総当たり耐性が必要）ため、意図的に除外リストへ
 * 加えていない（feature-flag-design.md）。
 */
const RATE_LIMIT_EXEMPT_REASONS: ReadonlySet<ServiceAuthExemptReason> = new Set(
    ['cors-preflight', 'monitoring', 'has-own-auth'],
);

/**
 * 「書き込み系」とみなす HTTP メソッド（SEC-013）。
 * これらは `RATE_LIMITER_WRITE` バインディングを使い、それ以外（GET/HEAD等の
 * 読み取り）は従来どおり `RATE_LIMITER` を使う。書き込みはDB更新・外部リソース
 * 消費を伴い閲覧より単価・悪用リスクが高いため、専用の厳しい制限を設ける。
 */
const WRITE_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'DELETE']);

/**
 * レート制限の期間（秒）。QERR-04対応: Cloudflare Rate Limiting APIの`limit()`戻り値には
 * 残り時間が含まれないため、`Retry-After`ヘッダには固定値として制限期間そのものを返す
 * （厳密な残り時間ではないが、クライアントに「少なくともこの秒数待てば良い」という
 * 目安を与えられる）。5パッケージ全ての`wrangler.toml`の`[[ratelimits]] simple.period`が
 * 全バインディング共通で60のため、ここも60で固定する。値を変更する場合は
 * 全wrangler.tomlのperiodと揃えること。
 */
const RATE_LIMIT_PERIOD_SECONDS = 60;

/**
 * リクエストの HTTP メソッドに応じて、使用すべきレート制限バインディングを解決する
 * （SEC-013）。書き込み系（POST/PUT/DELETE）は `env.RATE_LIMITER_WRITE`、
 * それ以外（GET/HEAD等の読み取り）は `env.RATE_LIMITER` を返す。
 * 対応するバインディングが環境に存在しない場合（ローカル/テスト環境等）は
 * `undefined` を返し、呼び出し側でフェイルオープンする。
 * @param env - Cloudflare Workers の環境変数
 * @param method - リクエストの HTTP メソッド
 * @returns 使用すべき `RateLimit` バインディング（無ければ `undefined`）
 */
const resolveRateLimiter = (
    env: CloudFlareEnv,
    method: string,
): RateLimit | undefined =>
    WRITE_METHODS.has(method) ? env.RATE_LIMITER_WRITE : env.RATE_LIMITER;

/**
 * バインディング未設定（フェイルオープン）を既にログ済みのバインディング名（CFSEC-02）。
 * `wrangler.toml` の設定ミス等でバインディングが恒久的に欠落しているケースを想定した
 * プロセス起動中1回限りのフラグで、リクエストごとに出すとログが溢れるため
 * `cors.ts` の `getAllowedOrigins` メモ化と同様にモジュールスコープで記憶する。
 */
const loggedMissingBindingFor = new Set<
    'RATE_LIMITER' | 'RATE_LIMITER_WRITE'
>();

/**
 * レート制限バインディングが未設定（フェイルオープン）であることを、
 * バインディング名ごとに初回のみログに記録する（CFSEC-02）。
 * CFARCH-01（`[[ratelimits]]` が named environment に継承されず全環境で
 * バインディングが欠落していた事故）が、このログの欠如により長期間気づかれなかった。
 * @param method - リクエストの HTTP メソッド（ログ対象のバインディング名を判定するために使う）
 */
const logMissingBindingOnce = (method: string): void => {
    const bindingName = WRITE_METHODS.has(method)
        ? 'RATE_LIMITER_WRITE'
        : 'RATE_LIMITER';
    if (loggedMissingBindingFor.has(bindingName)) return;
    loggedMissingBindingFor.add(bindingName);
    appLogger.error(
        `Rate limit binding "${bindingName}" is not configured; failing open (CFSEC-02)`,
    );
};

/**
 * テスト専用: `loggedMissingBindingFor` の「初回ログ済み」記憶をリセットする。
 *
 * bun test は全テストファイルを単一プロセス内で実行し、モジュールは
 * パスごとにキャッシュされて共有されるため、他のテストファイル（他パッケージの
 * router テスト等、バインディング未設定のままミドルウェアを通す全てのテスト）が
 * 先に実行されると、このモジュールスコープの記憶が既に埋まった状態になり、
 * 「初回ログ済み」の振る舞いをテストできなくなる。本体コード
 * （`rateLimitMiddleware`）からは呼ばれない、テストの独立性確保専用の export。
 */
export const resetRateLimitLoggingStateForTesting = (): void => {
    loggedMissingBindingFor.clear();
};

/**
 * リクエストの method/path が、サービス間認証の免除ルート一覧の中で
 * レート制限の対象にすべきものかを判定する。
 *
 * サービス間認証で保護されているルート（一覧に無いルート）は、
 * `SERVICE_AUTH_TOKEN` を持つ信頼できる呼び出し元（他 Worker）からの
 * トラフィックのみのため、このミドルウェアでは対象外とする
 * （公開GET・ヘルスチェック以外を主対象とする方針、SEC-012 参照）。
 * @param method - リクエストの HTTP メソッド
 * @param path - リクエストのパス
 * @param exemptRoutes - サービス間認証の免除ルート一覧
 * @returns レート制限の対象にすべきなら true
 */
export const shouldRateLimit = (
    method: string,
    path: string,
    exemptRoutes: readonly ServiceAuthExemptRoute[],
): boolean => {
    const matched = exemptRoutes.find(
        (route) =>
            route.method === method &&
            (route.path === path || route.path === '*'),
    );
    if (!matched) return false;
    return !RATE_LIMIT_EXEMPT_REASONS.has(matched.reason);
};

/**
 * レート制限判定に使うキーを解決する。
 * `CF-Connecting-IP`（Cloudflare が付与する実クライアントIP）を優先し、
 * 取得できない場合（テスト環境等）は固定キーへフォールバックする
 * （フォールバック時は全リクエストが同一キーを共有するため、実質的に
 * Worker全体で1クライアント相当のレート制限になる。ローカル/テスト
 * 環境限定の縮退動作であり、本番の Cloudflare Workers では常に
 * `CF-Connecting-IP` が付与される）。
 * @param c - Hono コンテキスト
 */
const resolveRateLimitKey = (c: Context): string =>
    c.req.header('CF-Connecting-IP') ?? 'unknown';

/**
 * レート制限に達したことをログに記録する。
 * @param c - Hono コンテキスト
 * @param key - レート制限判定に使ったキー
 */
const logRateLimitExceeded = (c: Context, key: string): void => {
    appLogger.warn('Rate limit exceeded', {
        method: c.req.method,
        path: c.req.path,
        key,
    });
};

/**
 * Cloudflare Rate Limiting API（`env.RATE_LIMITER` / `env.RATE_LIMITER_WRITE`）を
 * 使って、サービス間認証で保護されていない公開エンドポイント（GET /place・/race 等）に
 * IPベースのレート制限を適用する Hono ミドルウェアを生成する（SEC-011, SEC-013）。
 *
 * GET/HEAD等の読み取りには `RATE_LIMITER`、POST/PUT/DELETE等の書き込みには
 * より厳しい `RATE_LIMITER_WRITE` を、HTTPメソッドに応じて自動的に使い分ける
 * （`resolveRateLimiter` 参照）。免除ルート判定（`shouldRateLimit`）のロジックは
 * SEC-011から変更していない。
 *
 * 選択されたバインディングが存在しない環境（ローカル開発・テスト等）では
 * `next()` を呼ぶ（フェイルオープン。設定ミスでレート制限を全API停止の
 * トリガーにはしない方針）。ただし CFSEC-02 対応により、バインディング名ごとに
 * 初回のみ `appLogger.error` で記録するため、本番相当の環境で恒久的に
 * 欠落している場合は検知できる（`logMissingBindingOnce` 参照）。
 * @param exemptRoutes - サービス間認証の免除ルート一覧（`SERVICE_AUTH_EXEMPT_ROUTES`）
 * @returns Hono ミドルウェア
 */
export const rateLimitMiddleware = (
    exemptRoutes: readonly ServiceAuthExemptRoute[],
): MiddlewareHandler => {
    return async (c: Context, next: Next) => {
        // SAFETY: c.env が undefined の場合（bindings未設定のテスト等）は空オブジェクトへ
        // フォールバックするだけで、直後の resolveRateLimiter は該当バインディングが
        // 存在しなければフェイルオープン（next()呼び出し）する設計のため、
        // CloudFlareEnv として扱っても安全に扱われる。
        const env = (c.env ?? {}) as CloudFlareEnv;
        const limiter = resolveRateLimiter(env, c.req.method);
        if (!limiter) {
            logMissingBindingOnce(c.req.method);
            await next();
            return;
        }

        if (!shouldRateLimit(c.req.method, c.req.path, exemptRoutes)) {
            await next();
            return;
        }

        const key = resolveRateLimitKey(c);
        const { success } = await limiter.limit({ key });
        if (!success) {
            logRateLimitExceeded(c, key);
            return c.json(
                {
                    status: 429,
                    message: 'Too Many Requests',
                    code: 'TOO_MANY_REQUESTS',
                },
                429,
                { 'Retry-After': String(RATE_LIMIT_PERIOD_SECONDS) },
            );
        }

        await next();
        return;
    };
};
