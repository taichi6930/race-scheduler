import { json } from '../http/response';
import { appLogger } from './appLogger';
import { isInternalServiceCall } from './requestContext';
import { sanitizeError } from './sanitizeLog';
import { isStringValue } from './validation';
import { ValidationError } from './validationError';

/**
 * 500 応答としてクライアントへ返す汎用メッセージ（SEC-017）。
 *
 * `error.message` には内部実装の詳細（DBエラー文言等）が含まれうるため、
 * クライアント向け応答には含めない。詳細は `sanitizeError` 済みの値として
 * ログにのみ残す。
 *
 * ただし `resolveInternalErrorMessage` により、サービス間認証済みの呼び出し
 * （batch→scraping→api等、外部非公開）に限りこの制約を緩め、詳細を返す。
 */
const GENERIC_INTERNAL_ERROR_MESSAGE = 'Internal Server Error';

/**
 * 500 応答に載せるメッセージを決定する。
 *
 * サービス間認証済みの呼び出し（`requireServiceAuth` を通過した内部呼び出し）
 * に限り `sanitizeError` 済みの実際のエラー内容を返す。batch Workflow の失敗
 * 通知Issue（`notifyBatchWorkflowFailure.ts`）はこの応答本文をそのまま転記する
 * ため、原因調査にCloudflare Workers Logsの手動確認が不要になる。
 * 公開エンドポイント（front等が到達しうるルート）やCLI・テストからの直接呼び出し
 * では、`isInternalServiceCall()` が false になるため従来通り汎用メッセージのみ
 * を返し、SEC-017の意図（不特定多数への内部詳細非開示）は維持する。
 * @param error - キャッチされたエラー
 * @returns 500応答へ載せるメッセージ
 */
export const resolveInternalErrorMessage = (error: unknown): string => {
    if (!isInternalServiceCall()) {
        return GENERIC_INTERNAL_ERROR_MESSAGE;
    }
    const { name, message } = sanitizeError(error);
    return isStringValue(message)
        ? `${isStringValue(name) ? name : 'Error'}: ${message}`
        : GENERIC_INTERNAL_ERROR_MESSAGE;
};

/**
 * エラーメッセージを一貫したフォーマットで生成するユーティリティ
 *
 * - prefix: エラー発生箇所や処理名
 * - error: Errorインスタンスまたはunknown
 * - 例: createErrorMessage('API', error) → 'API: ...'
 * - 不明なエラーは 'Unknown error' を付加
 *
 * 使用例:
 *   try { ... } catch (e) {
 *     appLogger.error(createErrorMessage('Data Fetch', e));
 *   }
 */

export const createErrorMessage = (prefix: string, error: unknown): string => {
    if (error instanceof Error) {
        return `${prefix}: ${error.message}`;
    }
    return `${prefix}: Unknown error`;
};

/**
 * unknown なエラーから表示用メッセージ文字列を取り出す。
 *
 * `error instanceof Error ? error.message : String(error)` の定型を一元化する。
 * api / batch の router や repository で重複していた同一式を集約する。
 * @param error - キャッチされたエラー（Error インスタンスまたは任意の値）
 * @returns Error なら message、そうでなければ String() で文字列化した値
 */
export const toErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

/**
 * コントローラーメソッド用の汎用エラーハンドラー
 * 非同期関数をラップしてエラーを一元処理
 *
 * ValidationErrorは別途キャッチして適切なレスポンスを返す必要があるため、
 * 汎用ラッパーとしてではなく、try/catchの中でこの関数を使用することを想定
 * @param error - キャッチされたエラーオブジェクト
 * @param methodName - エラーが発生したメソッド名（ログ出力用）
 * @returns InternalErrorレスポンス
 */
export function handleControllerError(
    error: unknown,
    methodName: string,
): Response {
    // ValidationErrorの場合は呼び元側で処理すること
    if (error instanceof ValidationError) {
        throw error;
    }

    appLogger.error(`Error in ${methodName}:`, sanitizeError(error));

    // クライアントへは汎用メッセージのみ返す（response.json 経由で CORS ヘッダーを付与する）。
    // error.message の詳細は上記ログに残るほか、サービス間認証済みの呼び出しに
    // 限り応答本文にも含める（`resolveInternalErrorMessage`、SEC-017の例外）。
    return json(
        {
            status: 500,
            message: resolveInternalErrorMessage(error),
        },
        500,
    );
}
