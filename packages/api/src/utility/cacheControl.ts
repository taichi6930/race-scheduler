/**
 * キャッシュコントロールミドルウェア
 *
 * 読み取り専用エンドポイント（GET）に対してキャッシュヘッダーを設定します。
 * 判定ロジック・ヘッダー値の組み立ては core の純関数
 * （`isCacheableGetResponse` / `buildCacheControlHeader`）に集約し、
 * 本ファイルは Hono ミドルウェアの薄いラッパに徹します。
 * @module cacheControl
 */

import {
    buildCacheControlHeader,
    isCacheableGetResponse,
} from '@race-schedule/core';
import type { Context, Next } from 'hono';

/**
 * キャッシュコントロールミドルウェアを作成
 *
 * GET リクエストで成功時（2xx）に Cache-Control ヘッダーを設定します。
 * @param maxAge クライアント側キャッシュ有効期限（秒）
 * @param sMaxAge CDN/プロキシ側キャッシュ有効期限（秒）
 * @returns ミドルウェア関数
 * @example
 * // 60秒のクライアントキャッシュ、300秒の CDN キャッシュ
 * router.use('/calendar', createCacheControlMiddleware(60, 300));
 */
export const createCacheControlMiddleware =
    (maxAge: number, sMaxAge: number) =>
    async (c: Context, next: Next): Promise<void> => {
        await next();
        if (isCacheableGetResponse(c.req.method, c.res.ok)) {
            c.res.headers.set(
                'Cache-Control',
                buildCacheControlHeader(maxAge, sMaxAge),
            );
        }
    };
