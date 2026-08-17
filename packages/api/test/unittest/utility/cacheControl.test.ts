/**
 * cacheControl.test.ts - createCacheControlMiddleware のユニットテスト
 *
 * ## デシジョンテーブル（createCacheControlMiddleware）
 *
 * | #    | method | res.ok | If-None-Match      | 期待結果                                     |
 * |------|--------|--------|---------------------|-----------------------------------------------|
 * | T-01 | GET    | true   | 無し                | Cache-Control・ETag ヘッダーを設定する        |
 * | T-02 | POST   | true   | 無し                | ヘッダーを設定しない（GET以外）               |
 * | T-03 | GET    | false  | 無し                | ヘッダーを設定しない（2xx以外）               |
 * | T-04 | GET    | true   | 無し                | next() を待ってからヘッダーを設定する         |
 * | T-05 | GET    | true   | ETag と不一致       | 200 のまま・ボディを維持する                  |
 * | T-06 | GET    | true   | ETag と一致         | 304・ボディ無し・Cache-Controlは維持          |
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock, spyOn } from 'bun:test';
import { buildETagFromContent } from '@race-schedule/core';
import type { Context, Next } from 'hono';

import { createCacheControlMiddleware } from '../../../src/utility/cacheControl';

interface MockContext {
    req: { method: string; header: Mock<(name: string) => string | undefined> };
    res: Response;
}

const createMockContext = (
    method: string,
    status: number,
    ifNoneMatch?: string,
    body = 'body',
): MockContext => ({
    req: {
        method,
        header: mock(() => ifNoneMatch),
    },
    res: new Response(body, { status }),
});

describe('createCacheControlMiddleware', () => {
    it('createCacheControlMiddleware_GETかつ2xx_CacheControlとETagヘッダーを設定すること', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(60, 300);
        const c = createMockContext('GET', 200);
        const setSpy = spyOn(c.res.headers, 'set');
        const next: Next = mock(async () => {});

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(setSpy).toHaveBeenCalledWith(
            'Cache-Control',
            'public, max-age=60, s-maxage=300',
        );
        expect(c.res.headers.get('ETag')).toBe(buildETagFromContent('body'));
    });

    it('createCacheControlMiddleware_POST_ヘッダーを設定しないこと', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(60, 300);
        const c = createMockContext('POST', 200);
        const setSpy = spyOn(c.res.headers, 'set');
        const next: Next = mock(async () => {});

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(setSpy).not.toHaveBeenCalled();
    });

    it('createCacheControlMiddleware_GETだが2xx以外_ヘッダーを設定しないこと', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(60, 300);
        const c = createMockContext('GET', 500);
        const setSpy = spyOn(c.res.headers, 'set');
        const next: Next = mock(async () => {});

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(setSpy).not.toHaveBeenCalled();
    });

    it('createCacheControlMiddleware_next完了後にヘッダーを設定すること', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(10, 20);
        const c = createMockContext('GET', 200);
        const order: string[] = [];
        const next: Next = mock(async () => {
            order.push('next');
        });
        spyOn(c.res.headers, 'set').mockImplementation(() => {
            order.push('set');
        });

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(order).toEqual(['next', 'set', 'set']);
    });

    it('createCacheControlMiddleware_IfNoneMatchが不一致_200のままボディを維持すること', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(60, 300);
        const c = createMockContext('GET', 200, 'W/"stale"', 'body');
        const next: Next = mock(async () => {});

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(c.res.status).toBe(200);
        expect(await c.res.clone().text()).toBe('body');
    });

    it('createCacheControlMiddleware_IfNoneMatchが一致_304を返しCacheControlを維持すること', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(60, 300);
        const c = createMockContext('GET', 200, undefined, 'body');
        const etag = buildETagFromContent('body');
        c.req.header = mock(() => etag);
        const next: Next = mock(async () => {});

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(c.res.status).toBe(304);
        expect(c.res.headers.get('Cache-Control')).toBe(
            'public, max-age=60, s-maxage=300',
        );
        expect(await c.res.clone().text()).toBe('');
    });
});
