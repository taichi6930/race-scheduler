import type { Context, MiddlewareHandler, Next } from 'hono';

/**
 * 全レスポンス共通のセキュリティヘッダー（SEC-031）。
 *
 * 本アプリの4 Worker（api/batch/calendar/scraping）は全エンドポイントがJSONのみを
 * 返す（HTML/JS等のレンダリング対象を返さない）ため、CSP
 * （Content-Security-Policy）はブラウザ描画に対する防御という本来の目的が薄いが、
 * レスポンスが何らかの理由で誤ってHTMLとして解釈された場合の多層防御として
 * `default-src 'none'` を設定する（実行可能なリソースを一切許可しない）。
 * `X-Content-Type-Options`はMIMEタイプスニッフィングを防ぎ、`Referrer-Policy`は
 * リファラ経由の情報漏洩を防ぐ。front側（`packages/front/web/index.html`）のCSP設定は
 * SEC-055で別途検討中（実機検証を伴う高リスク変更のため見送り中）。
 *
 * 例外: api の `GET /docs`（Scalar製のHTML UI）・`GET /admin/flags`
 * （機能フラグ管理画面、feature-flag-design.md）は、JS/CSSを描画する実際の
 * HTMLレンダリング対象のため、`default-src 'none'`のままだとブラウザが
 * スクリプトの読み込み・fetchをブロックし、画面が空白になる（`/docs`は実機で
 * 確認済みの不具合）。`cspOverrides`（パスごとのCSP文字列のMap）で、
 * パスごとに必要最小限まで緩和したCSPを適用できるようにする（他3 Workerには
 * 影響しない、api側のみでオプション指定）。
 */
const SECURITY_HEADERS_BASE: ReadonlyArray<readonly [string, string]> = [
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'no-referrer'],
];

const DEFAULT_CSP = "default-src 'none'";

/**
 * {@link securityHeadersMiddleware} のオプション。
 */
export interface SecurityHeadersOptions {
    /**
     * パスごとに適用するCSPのMap（キー: リクエストパスの完全一致、値: 適用するCSP文字列）。
     * ページごとに許可するオリジン・ディレクティブが異なりうるため、単一のCSP文字列では
     * なくパス単位で持たせる（`/docs`はCDN許可、`/admin/flags`は`'self'`のみ等）。
     */
    cspOverrides?: ReadonlyMap<string, string>;
}

/**
 * リクエストパスに応じて適用すべきCSPを解決する。
 * `cspOverrides` に該当パスのエントリがあればその値、無ければ既定の
 * `default-src 'none'` を返す。
 * @param options - {@link securityHeadersMiddleware} のオプション
 * @param path - 判定対象のリクエストパス
 * @returns 適用するCSP文字列
 */
const resolveCsp = (
    options: SecurityHeadersOptions | undefined,
    path: string,
): string => options?.cspOverrides?.get(path) ?? DEFAULT_CSP;

/**
 * 全レスポンスにセキュリティヘッダーを付与する Hono ミドルウェアを生成する（SEC-031）。
 *
 * `c.json()`（Hono標準）・`json()`（core/http/response.ts）のどちらでレスポンスを
 * 組み立てても確実に付与されるよう、CORS・サービス間認証と同様にミドルウェアとして
 * 全 Worker の router に登録する。
 * @param options - CSPの例外パスを指定するオプション（省略時は常に`default-src 'none'`）
 * @returns Hono ミドルウェア
 */
export const securityHeadersMiddleware = (
    options?: SecurityHeadersOptions,
): MiddlewareHandler => {
    return async (c: Context, next: Next) => {
        await next();
        c.header('Content-Security-Policy', resolveCsp(options, c.req.path));
        for (const [name, value] of SECURITY_HEADERS_BASE) {
            c.header(name, value);
        }
    };
};
