import { withCorsHeaders } from '../http/cors';

/**
 * 全レスポンス共通のセキュリティヘッダー（SEC-031）。
 *
 * 本アプリは全エンドポイントがJSONのみを返す（HTML/JS等のレンダリング対象を
 * 返さない）ため、CSP（Content-Security-Policy）はブラウザ描画に対する防御という
 * 本来の目的が薄いが、レスポンスが何らかの理由で誤ってHTMLとして解釈された場合の
 * 多層防御として `default-src 'none'` を設定する（実行可能なリソースを一切許可しない）。
 * `X-Content-Type-Options`はMIMEタイプスニッフィングを防ぎ、`Referrer-Policy`は
 * リファラ経由の情報漏洩を防ぐ。front側（`packages/front/web/index.html`）のCSP設定は
 * SEC-055で別途検討中（実機検証を伴う高リスク変更のため見送り中）。
 */
const SECURITY_HEADERS = {
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
} as const satisfies Record<string, string>;

export const json = (
    body: unknown,
    status = 200,
    headers?: HeadersInit,
): Response =>
    Response.json(body, {
        status,
        headers: { ...SECURITY_HEADERS, ...withCorsHeaders(headers) },
    });

/**
 * QAPI-08: エラーレスポンスの機械可読なコード（HTTPステータスコード起点の安定値）。
 *
 * `message` は日本語/英語の自由文言で仕様変更に応じて書き換わりうるため、
 * クライアントが原因判定に使う値としては不安定。本コードはHTTPステータスから
 * 一意に導出する安定値とし、`badRequest`/`internalError`呼び出し側の20箇所超を
 * 個別修正せずに済むよう、既存の `status` 引数から自動的に付与する。
 */
/** HTTPステータスコード → 機械可読なエラーコードの対応表。 */
interface ErrorCodeByStatus {
    readonly [status: number]: string;
}

export const ERROR_CODE_BY_STATUS: ErrorCodeByStatus = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_ERROR',
};

/**
 * [status] に対応する安定コードを返す。未知のstatusは汎用の 'ERROR' にフォールバックする。
 * @param status - HTTPステータスコード
 * @returns 機械可読なエラーコード
 */
export const errorCodeForStatus = (status: number): string =>
    ERROR_CODE_BY_STATUS[status] ?? 'ERROR';

export const badRequest = (message: string, status = 400): Response =>
    json({ status, message, code: errorCodeForStatus(status) }, status);

export const internalError = (): Response =>
    json(
        {
            status: 500,
            message: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
        },
        500,
    );
