import { appLogger } from '../utilities/appLogger';

/**
 * @file CORS（Cross-Origin Resource Sharing）ヘッダー管理
 *
 * クロスオリジンリクエストに対応するための CORS ヘッダーを生成・管理するユーティリティです。
 *
 * 機能：
 * - Origin ホワイトリスト管理（環境変数での上書き可）
 * - リクエストの Origin がホワイトリストに含まれているか検証
 * - 検証結果に基づいた CORS ヘッダーの生成
 * - レスポンスオブジェクトへの CORS ヘッダー追加
 *
 * セキュリティ注意：
 * - デフォルトでは localhost のみを許可（開発環境用）
 * - 本番環境では CORS_ALLOWED_ORIGINS 環境変数で許可オリジンを指定すること
 * - ワイルドカード許可（*）は推奨されません
 */

/** HTTPヘッダー名 → 値の対応表。 */
interface HeaderRecord {
    [name: string]: string;
}

/**
 * デフォルトで許可するオリジン（開発環境用）。
 * 環境変数 CORS_ALLOWED_ORIGINS が未設定の場合に使用する localhost 群。
 */
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
];

/** CORS で許可する HTTP メソッド（Access-Control-Allow-Methods） */
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

/** CORS で許可するリクエストヘッダー（Access-Control-Allow-Headers） */
const ALLOWED_HEADERS = 'Content-Type';

/**
 * 実行環境が production かどうかを判定する（SEC-014）。
 * `process` が存在しない環境（Workers 等）では false を返す。
 * @returns production 環境であれば true
 */
const isProductionEnv = (): boolean =>
    globalThis.process?.env.NODE_ENV === 'production';

/**
 * production 環境で `CORS_ALLOWED_ORIGINS` にワイルドカード（`*`）が
 * 混入していた場合に、それを取り除いた許可オリジン一覧を返す（SEC-014）。
 *
 * 環境変数の設定ミス一つで全オリジン許可になる事故を防ぐ多層防御。
 * ワイルドカードを除去した結果が空になった場合はデフォルト値（localhost群、
 * 本番オリジンとは一致しないため実質的に全拒否）にフォールバックする。
 * @param envOrigins - 環境変数から分解された許可オリジンの配列
 * @returns ワイルドカードを取り除いた許可オリジンの配列
 */
const rejectWildcardInProduction = (envOrigins: string[]): string[] => {
    if (!envOrigins.includes('*')) {
        return envOrigins;
    }

    appLogger.error(
        'CORS_ALLOWED_ORIGINS="*" is not allowed in production; ignoring the wildcard entry (SEC-014)',
    );
    const withoutWildcard = envOrigins.filter((origin) => origin !== '*');
    return withoutWildcard.length > 0
        ? withoutWildcard
        : DEFAULT_ALLOWED_ORIGINS;
};

/**
 * 末尾のスラッシュを取り除く。ブラウザが送る `Origin` ヘッダーには末尾スラッシュが
 * 付かないため、`CORS_ALLOWED_ORIGINS` に末尾スラッシュ付きで設定してしまうと
 * 完全一致比較（`getAllowedOrigin`）が常に失敗し、「設定したのにCORSエラーのまま」
 * という気づきにくい設定ミスになる。GitHub Actionsのrepository variableのような
 * UI入力は目視でスラッシュの有無を見落としやすいため、両側で正規化して吸収する。
 * @param value - 正規化対象のオリジン文字列
 * @returns 末尾スラッシュを除いた文字列
 */
const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

/**
 * envOriginsRaw（CORS_ALLOWED_ORIGINS の生値）から許可オリジンの配列を解決する。
 * `getAllowedOrigins` のキャッシュ判定から解決ロジックだけを切り出したもの。
 * @param envOriginsRaw - `process.env.CORS_ALLOWED_ORIGINS` の値（未設定なら undefined）
 * @returns 許可オリジンの配列（未設定時はデフォルト値）
 */
const resolveAllowedOrigins = (envOriginsRaw: string | undefined): string[] => {
    if (!envOriginsRaw) {
        return DEFAULT_ALLOWED_ORIGINS;
    }

    // `split(',')` は空文字列でも `['']` を返すため、この時点で envOrigins は
    // 必ず1件以上になる（`!envOriginsRaw` の早期リターンで空文字/undefinedは除外済み）。
    const envOrigins = envOriginsRaw
        .split(',')
        .map((s) => stripTrailingSlash(s.trim()));

    // デフォルトで localhost を許可（開発環境用）
    return isProductionEnv()
        ? rejectWildcardInProduction(envOrigins)
        : envOrigins;
};

// PERF-085: getAllowedOrigins() は json()/badRequest() 等あらゆるレスポンス生成経路から
// 呼ばれるため、CORS_ALLOWED_ORIGINS の解決結果が変わらない限り再パースを避けてメモ化する。
// api/batch の createCachedCorsMiddleware（PERF-048）と同じ「キーが変わったら再計算」パターン。
// SEC-014: resolveAllowedOrigins() の結果は isProductionEnv() にも依存するため、
// キャッシュキーには CORS_ALLOWED_ORIGINS の生値と production 判定の両方を含める
// （生値だけをキーにすると、NODE_ENV だけが変化したケースで古い判定結果を返してしまう）。
let cachedEnvOriginsRaw: string | undefined;
let cachedIsProduction: boolean | undefined;
let cachedAllowedOrigins: string[] | undefined;

/**
 * 許可オリジンのキャッシュが古くなっているか（生値・production判定のいずれかが
 * 前回と異なるか）を判定する。呼び出し側の if 文へ直接書くと複合条件（||）になるため、
 * 単独でテストできる述語関数として切り出す。
 * @param envOriginsRaw - 今回の `CORS_ALLOWED_ORIGINS` 生値
 * @param isProduction - 今回の production 判定結果
 * @returns キャッシュが古くなっていれば true
 */
const isAllowedOriginsCacheStale = (
    envOriginsRaw: string | undefined,
    isProduction: boolean,
): boolean =>
    envOriginsRaw !== cachedEnvOriginsRaw ||
    isProduction !== cachedIsProduction;

/**
 * CORS 許可リスト
 * デフォルトでは localhost のみが許可される
 * 本番環境では環境変数 CORS_ALLOWED_ORIGINS で設定可能
 * 例: CORS_ALLOWED_ORIGINS="https://example.com,https://app.example.com"
 * @param overrideRaw - `process.env.CORS_ALLOWED_ORIGINS` より優先して使う生値（省略可）。
 *   Cloudflare Workers の `c.env.CORS_ALLOWED_ORIGINS`（リクエスト時にしか取得できない
 *   per-request バインディング）を渡したい呼び出し元（api）向け（refactor#134）。
 *   他 Worker（batch/scraping/calendar）は従来どおり引数無しで呼び出せば
 *   `process.env` ベースの挙動が変わらない。
 * @returns 許可オリジンの配列
 */
export const getAllowedOrigins = (overrideRaw?: string): string[] => {
    // 複合条件（&&）をガード節に分解し、C2組み合わせテストを回避する。
    // process が存在しない環境（Workers等）では undefined を使う。
    const processOriginsRaw = globalThis.process?.env.CORS_ALLOWED_ORIGINS;
    const envOriginsRaw = overrideRaw ?? processOriginsRaw;

    const isProduction = isProductionEnv();

    if (cachedAllowedOrigins === undefined) {
        cachedAllowedOrigins = resolveAllowedOrigins(envOriginsRaw);
        cachedEnvOriginsRaw = envOriginsRaw;
        cachedIsProduction = isProduction;
        return cachedAllowedOrigins;
    }

    if (isAllowedOriginsCacheStale(envOriginsRaw, isProduction)) {
        cachedAllowedOrigins = resolveAllowedOrigins(envOriginsRaw);
        cachedEnvOriginsRaw = envOriginsRaw;
        cachedIsProduction = isProduction;
    }

    return cachedAllowedOrigins;
};

/**
 * リクエストの Origin がホワイトリストに含まれているか確認
 * @param origin リクエストの Origin ヘッダーの値
 * @returns 許可されている場合は origin、否則は null
 */
const getAllowedOrigin = (origin: string | null): string | null => {
    const allowedOrigins = getAllowedOrigins();

    // ワイルドカード許可がリストに含まれている場合のみ全許可
    if (allowedOrigins.includes('*')) {
        return '*';
    }

    if (!origin) return null;

    // 完全一致チェック（許可リスト側は末尾スラッシュ正規化済みのため、
    // 比較対象のoriginも同様に正規化する。レスポンスヘッダーには
    // リクエストの生origin値をそのまま返す）。
    if (allowedOrigins.includes(stripTrailingSlash(origin))) {
        return origin;
    }

    return null;
};

// PERF-086: getCorsHeaders() は withCorsHeaders() 経由で json()/badRequest() 等
// あらゆるレスポンス生成経路から呼ばれるため、同一 allowedOrigin に対しては
// 毎回新規オブジェクトを生成せず Map でキャッシュする。allowedOrigins（許可リスト本体）
// が変わった場合（PERF-085のキャッシュが再計算された場合）はキャッシュを作り直し、
// 環境変数変更後も古い判定結果を返さないようにする。
let corsHeadersCache = new Map<string, HeaderRecord>();
let corsHeadersCacheAllowedOriginsRef: string[] | undefined;

/**
 * CORS ヘッダーを生成（allowedOrigin 単位でメモ化）
 * @param origin リクエストの Origin ヘッダーの値
 * @returns CORS ヘッダー
 */
const getCorsHeaders = (origin: string | null): HeaderRecord => {
    const allowedOrigins = getAllowedOrigins();

    // getAllowedOrigins() の返り値の参照が変わった（＝環境変数の変更でキャッシュが
    // 再計算された）場合は、古い許可判定結果を使い回さないようキャッシュを破棄する。
    if (allowedOrigins !== corsHeadersCacheAllowedOriginsRef) {
        corsHeadersCache = new Map();
        corsHeadersCacheAllowedOriginsRef = allowedOrigins;
    }

    const allowedOrigin = getAllowedOrigin(origin);
    const cacheKey = allowedOrigin ?? 'null';

    const cached = corsHeadersCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const headers = Object.freeze({
        'Access-Control-Allow-Origin': allowedOrigin || 'null',
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        // PERF-037: Access-Control-Allow-Origin はリクエストの Origin ヘッダーに応じて
        // 値が変わる（ワイルドカード許可時を除く）ため、共有キャッシュ/CDN が誤ったオリジン
        // 向けのレスポンスを別オリジンへ配信してしまわないよう Vary: Origin を明示する。
        Vary: 'Origin',
    });
    corsHeadersCache.set(cacheKey, headers);
    return headers;
};

/**
 * headers が実行環境の Headers インスタンスかどうかを判定する型ガード。
 * 複合条件（&&）を独立関数に切り出し、C2組み合わせテストを回避する。
 * @param headers - 判定対象の HeadersInit
 * @returns Headers インスタンスなら true
 */
const isHeadersInstance = (headers: HeadersInit): headers is Headers =>
    typeof Headers !== 'undefined' && headers instanceof Headers;

/**
 * headers 未指定時に使い回す共有の空オブジェクト。
 * withCorsHeaders 側で常にスプレッド（`{...normalizeHeaders(headers)}`）してから
 * 使うだけで、この参照自体が外部へ渡って変更される経路は無いため、呼び出しごとに
 * 新規オブジェクトを割り当てる代わりに固定インスタンスを再利用できる（PERF-086）。
 */
const EMPTY_HEADER_RECORD: HeaderRecord = Object.freeze({});

const normalizeHeaders = (headers?: HeadersInit): HeaderRecord => {
    if (!headers) return EMPTY_HEADER_RECORD;
    if (isHeadersInstance(headers)) {
        const record: HeaderRecord = {};
        // Headers.forEach is the most reliable API in the Workers runtime
        headers.forEach((value, key) => {
            record[key] = value;
        });
        return record;
    }
    if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
    }
    return Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key, value]),
    );
};

export const withCorsHeaders = (
    headers?: HeadersInit,
    origin?: string | null,
): HeaderRecord => ({
    ...getCorsHeaders(origin ?? null),
    ...normalizeHeaders(headers),
});
