/**
 * HTTP通信の基本ラッパー
 * タイムアウト処理とエラーハンドリングを統一的に行う
 */

import { sleep, withRequestIdHeader } from '@race-schedule/core';
import type { ZodType } from 'zod';

import { FETCH_TIMEOUT_MS } from '../constants';

/**
 * リトライ回数のデフォルト値（最大2回リトライ = 計3試行）。
 * バッチ実行全体の失敗・再実行コストを抑えるため、一時的なエラー
 * （ネットワークエラー・5xx）に限定して控えめな回数だけ再試行する（PERF-055）
 */
const DEFAULT_MAX_RETRIES = 2;

/**
 * 指数バックオフの基準遅延時間（ミリ秒）。
 * 試行回数（0始まり）を指数として `RETRY_BASE_DELAY_MS * 2 ** attempt` で
 * 待機時間を算出する（100ms, 200ms, ...）
 */
const RETRY_BASE_DELAY_MS = 100;

/**
 * HTTPステータスコードが一時的なエラー（5xx）かどうかを判定する
 * @param status HTTPステータスコード
 * @returns 5xxの場合true
 */
function isRetryableStatus(status: number): boolean {
    return status >= 500;
}

/** 1回分のfetch試行結果 */
type FetchAttemptResult =
    | { ok: true; response: Response }
    | { ok: false; error: Error; retryable: boolean };

/**
 * 1回分のfetch試行を行い、成功時はレスポンスを、失敗時はエラーと
 * リトライ可否を返す（例外を投げない）
 * @param urlString リクエスト対象のURL文字列
 * @param options fetchオプション（メソッド、ボディ、ヘッダーなど）
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @returns 試行結果（成功時はレスポンス、失敗時はエラーとリトライ可否）
 */
async function attemptFetch(
    urlString: string,
    options: (RequestInit & { headers?: Record<string, string> }) | undefined,
    timeoutMs: number,
): Promise<FetchAttemptResult> {
    try {
        const response = await fetch(urlString, {
            ...options,
            headers: withRequestIdHeader(options?.headers),
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (response.ok) {
            return { ok: true, response };
        }

        const text = await response.text();
        return {
            ok: false,
            error: new Error(
                `API ${urlString} returned ${response.status}: ${text}`,
            ),
            retryable: isRetryableStatus(response.status),
        };
    } catch (error) {
        // fetch自体の例外（ネットワークエラー・AbortSignal.timeoutによる
        // タイムアウトを含む）は一時的なエラーとみなしリトライ対象とする
        const wrapped =
            error instanceof Error ? error : new Error(String(error));
        return { ok: false, error: wrapped, retryable: true };
    }
}

/**
 * 1回分の試行結果を受けて、成功ならJSONをスキーマ検証して返し、失敗なら
 * リトライ可否を判定してリトライ（自身を再帰呼び出し）するかエラーを送出する
 * @template T スキーマ検証後のレスポンス型
 * @param urlString リクエスト対象のURL文字列
 * @param schema レスポンスボディを検証するZodスキーマ
 * @param options fetchオプション（メソッド、ボディ、ヘッダーなど）
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @param maxRetries 最大リトライ回数
 * @param attempt 現在の試行回数（0始まり）
 * @returns スキーマ検証済みのレスポンスボディ
 */
async function fetchWithRetry<T>(
    urlString: string,
    schema: ZodType<T>,
    options: (RequestInit & { headers?: Record<string, string> }) | undefined,
    timeoutMs: number,
    maxRetries: number,
    attempt: number,
): Promise<T> {
    const result = await attemptFetch(urlString, options, timeoutMs);

    if (result.ok) {
        const json: unknown = await result.response.json();
        return schema.parse(json);
    }

    if (!result.retryable) {
        throw result.error;
    }

    const isLastAttempt = attempt === maxRetries;
    if (isLastAttempt) {
        throw result.error;
    }

    await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    return fetchWithRetry(
        urlString,
        schema,
        options,
        timeoutMs,
        maxRetries,
        attempt + 1,
    );
}

/**
 * タイムアウト付きでHTTPリクエストを実行し、レスポンスボディをZodスキーマで検証する。
 * 一時的なエラー（ネットワークエラー・5xxレスポンス）に対しては、指数バックオフで
 * 自動的にリトライする（4xxはクライアントエラーのためリトライしない、PERF-055）。
 * 呼び出し元の非同期実行コンテキストにリクエストIDがあれば `X-Request-Id` ヘッダを
 * 自動的に付与する（CFARCH-09、`withRequestIdHeader` 参照）。
 * @template T スキーマ検証後のレスポンス型
 * @param url リクエスト対象のURL
 * @param schema レスポンスボディを検証するZodスキーマ
 * @param options fetchオプション（メソッド、ボディ、ヘッダーなど）
 * @param timeoutMs タイムアウト時間（ミリ秒）。省略時は{@link FETCH_TIMEOUT_MS}
 * （5分、スクレイピング等の重い処理向け）を使用する。DB読み取りのみの軽量な
 * エンドポイントでは呼び出し元から `LIGHT_FETCH_TIMEOUT_MS` 等の短い値を
 * 明示的に渡すこと（PERF-080）
 * @param maxRetries 最大リトライ回数。省略時は{@link DEFAULT_MAX_RETRIES}（2回、計3試行）
 * @returns スキーマ検証済みのレスポンスボディ
 * @throws {Error} HTTPステータスが2xx以外の場合（リトライ上限到達後）、ネットワークエラーの場合
 * （リトライ上限到達後）、またはスキーマ検証に失敗した場合
 */
export async function fetchWithTimeout<T>(
    url: string | URL,
    schema: ZodType<T>,
    options?: RequestInit & { headers?: Record<string, string> },
    timeoutMs: number = FETCH_TIMEOUT_MS,
    maxRetries: number = DEFAULT_MAX_RETRIES,
): Promise<T> {
    return fetchWithRetry(
        url.toString(),
        schema,
        options,
        timeoutMs,
        maxRetries,
        0,
    );
}
