/**
 * キャッシュコントロールミドルウェア
 *
 * 読み取り専用エンドポイント（GET）に対してキャッシュヘッダーと ETag を設定し、
 * `If-None-Match` が一致する場合は 304 を返します。判定ロジック・ヘッダー値の
 * 組み立ては core の純関数（`isCacheableGetResponse` / `buildCacheControlHeader` /
 * `buildETagFromContent` / `isNoneMatch`）に集約し、本ファイルは Hono ミドルウェアの
 * 薄いラッパに徹します。
 * @module cacheControl
 * @remarks
 * CFCACHE-02: ETag はレスポンスボディをハッシュ化して算出するため、キャッシュ対象
 * （GET かつ 2xx）のリクエストごとにボディを1回読む分のコストが増える。
 */

import {
    buildCacheControlHeader,
    buildETagFromContent,
    isCacheableGetResponse,
    isNoneMatch,
} from '@race-schedule/core';
import type { Context, Next } from 'hono';

/**
 * キャッシュコントロールミドルウェアを作成
 *
 * GET リクエストで成功時（2xx）に Cache-Control ヘッダーと ETag を設定します。
 * リクエストの `If-None-Match` が ETag と一致する場合、ボディを落として
 * 304 Not Modified を返します（`Cache-Control` ヘッダーは維持する）。
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
        if (!isCacheableGetResponse(c.req.method, c.res.ok)) {
            return;
        }
        c.res.headers.set(
            'Cache-Control',
            buildCacheControlHeader(maxAge, sMaxAge),
        );
        const body = await c.res.clone().text();
        const etag = buildETagFromContent(body);
        c.res.headers.set('ETag', etag);
        if (isNoneMatch(c.req.header('If-None-Match'), etag)) {
            c.res = new Response(null, {
                status: 304,
                headers: c.res.headers,
            });
        }
    };
