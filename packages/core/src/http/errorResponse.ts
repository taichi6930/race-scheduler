/**
 * @file ルーター層の 500 エラーレスポンス共通ヘルパー
 *
 * api / batch の router が返す 500 応答ボディの形状を一元化する。
 * `{ status, message }` は controller 層の `handleControllerError` や
 * 4xx 系の `badRequest` と同じ形状（`status`/`message`/任意 `errors`）に揃えている。
 * Hono など特定フレームワークに依存しない web 標準の Response と、
 * Hono コンテキストの `c.json` に渡すためのボディビルダーの両方を提供する。
 */

import { appLogger } from '../utilities/appLogger';
import { resolveInternalErrorMessage } from '../utilities/error';
import { sanitizeError } from '../utilities/sanitizeLog';
import { json } from './response';

/** ルーター層の 500 エラー応答ボディ */
export interface InternalErrorResponseBody {
    status: 500;
    message: string;
    /** QAPI-08: 機械可読なエラーコード（`response.ts` の `errorCodeForStatus` 参照） */
    code: 'INTERNAL_ERROR';
}

/**
 * 500 応答としてクライアントへ返す汎用メッセージ（SEC-017）。
 *
 * `error.message` には内部実装の詳細（DBエラー文言・スタック由来の情報等）が
 * 含まれうるため、クライアント向け応答には含めない。詳細はログ側
 * （`logInternalError` が `sanitizeError` 経由で記録）にのみ残す。
 */
const GENERIC_INTERNAL_ERROR_MESSAGE = 'Internal Server Error';

/**
 * ルーター層の 500 応答ボディ `{ status: 500, message }` を組み立てる。
 *
 * Hono の `c.json(...)` に渡す用途を想定した純粋なボディビルダー。
 * ログ出力は呼び出し側（コンテキスト固有のメッセージを持つ）に委ねる。
 * @returns 500 応答ボディ
 */
export const internalErrorResponseBody = (): InternalErrorResponseBody => ({
    status: 500,
    message: GENERIC_INTERNAL_ERROR_MESSAGE,
    code: 'INTERNAL_ERROR',
});

/**
 * ルーター層の 500 エラーを web 標準 Response（CORS ヘッダー付き）として返す。
 *
 * Hono コンテキストを持たない箇所（batch の router など）から利用する。
 * レスポンスヘッダー生成（CORS付与）が response.ts の json() とこのファイルの
 * 2箇所に分散していたため、json() へ委譲して1箇所に集約した（PERF-089）。
 * @returns 500 の JSON Response
 */
export const internalErrorResponse = (): Response =>
    json(internalErrorResponseBody(), 500);

/**
 * ルーター層の 500 エラーをログ出力し、応答ボディを組み立てる。
 *
 * api / batch / scraping の router で個別に実装されていた
 * 「`appLogger.error` でサニタイズ済みエラーを記録 → 500 応答ボディを作る」定型を集約する。
 * ログメッセージは呼び出し側のコンテキスト（'API error' 等）を渡す。
 * @param logMessage - ログの先頭に付けるコンテキストメッセージ
 * @param error - キャッチされたエラー。ログには常に`sanitizeError`済みの値を残す。
 * クライアント応答には、公開エンドポイントでは含めない（SEC-017）が、
 * サービス間認証済みの呼び出しに限り`resolveInternalErrorMessage`経由で含める
 * @returns 500 応答ボディ（`c.json(body, 500)` にそのまま渡せる）
 */
export const logInternalError = (
    logMessage: string,
    error: unknown,
): InternalErrorResponseBody => {
    appLogger.error(logMessage, sanitizeError(error));
    return {
        status: 500,
        message: resolveInternalErrorMessage(error),
        code: 'INTERNAL_ERROR',
    };
};
