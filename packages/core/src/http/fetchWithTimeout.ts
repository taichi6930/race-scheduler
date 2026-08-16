/**
 * @file サービス間 HTTP 通信の基本ラッパー
 *
 * scraping → api、calendar → api など、Worker 間の内部 HTTP 通信で共通して使う
 * タイムアウト処理とエラーハンドリングを一元化する。
 */

import { withRequestIdHeader } from './requestIdHeader';

/** サービス間 HTTP 通信のデフォルトタイムアウト（ミリ秒） */
export const FETCH_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * タイムアウト付きで HTTP リクエストを実行する。
 *
 * CFARCH-09対応: 呼び出し元の非同期実行コンテキストにリクエストIDがあれば、
 * `X-Request-Id` ヘッダを自動的に付与する（`withRequestIdHeader` 参照）。
 * これにより batch → scraping/calendar → api のような呼び出し連鎖を
 * Workers Logs 上で同一IDとして相関付けられる。
 * @template T レスポンスの型
 * @param url リクエスト対象の URL
 * @param options fetch オプション（メソッド・ボディ・ヘッダーなど。`headers` は
 * `Record<string, string>` 形式のみサポート — 本パッケージ内の呼び出し元は全て
 * この形式でヘッダーを組み立てている）
 * @returns パースされたレスポンスボディ
 * @throws HTTP ステータスが 2xx 以外の場合、またはネットワークエラーの場合
 */
export const fetchWithTimeout = async <T>(
    url: string | URL,
    options?: RequestInit & { headers?: Record<string, string> },
): Promise<T> => {
    const urlString = url.toString();

    const response = await fetch(urlString, {
        ...options,
        headers: withRequestIdHeader(options?.headers),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `API ${urlString} returned ${response.status}: ${text}`,
        );
    }

    return await response.json();
};
