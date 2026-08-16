/**
 * API エラーハンドラー
 *
 * 各エンドポイントの catch ブロックで共通のエラー応答形式を提供します。
 * @module errorHandler
 */

import { logInternalError } from '@race-schedule/core';
import type { Context } from 'hono';

/**
 * API エラーを統一形式で返す（500 Internal Server Error）
 *
 * ログ出力（サニタイズ済みエラーの記録）と応答ボディ `{ status, message }` の組み立ては
 * core の `logInternalError` に集約し、api / batch / scraping で共有する。
 * エラー内容はログに出力するが、API キー・秘密鍵などの機密フィールドは
 * `sanitizeError` を通してマスクした上で記録する。
 * @param c Hono コンテキスト
 * @param error キャッチされたエラー
 * @returns Hono JSON レスポンス
 */
export const handleApiError = (c: Context, error: unknown) => {
    return c.json(logInternalError('API error', error), 500);
};
