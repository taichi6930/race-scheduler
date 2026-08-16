/**
 * @file リクエスト相関ID（`X-Request-Id`）を outbound fetch へ伝搬させるヘルパー（CFARCH-09）
 *
 * `requestContext.ts` の受信側（`resolveRequestId`/`runWithRequestId`）は実装済みだが、
 * batch → scraping → api のような Worker 間呼び出しで送信側が `X-Request-Id` を
 * 付けていなかったため、1本のバッチ処理が Workers Logs 上で無関係な複数のリクエストID
 * に分裂していた。`withServiceAuthHeader`（`serviceAuth.ts`）と同じ
 * 「既存ヘッダにキーを足して返す」形で揃える。
 */

import { getRequestId } from '../utilities/requestContext';

/** リクエスト相関ID（OBS-004）をやり取りする HTTP ヘッダー名 */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * 現在の非同期実行コンテキストにリクエストIDがあれば、既存のヘッダに
 * `X-Request-Id` を付与して返す。
 *
 * リクエストIDが無い場合（`runWithRequestId` のスコープ外、例えばバッチCLIの
 * 最上位呼び出し等）は、元のヘッダをそのまま返す。
 * @param headers - 元のヘッダ
 * @returns `X-Request-Id` 付与後のヘッダ
 */
export const withRequestIdHeader = (
    headers?: Record<string, string>,
): Record<string, string> => {
    const requestId = getRequestId();
    if (!requestId) {
        return { ...headers };
    }
    return { ...headers, [REQUEST_ID_HEADER]: requestId };
};
