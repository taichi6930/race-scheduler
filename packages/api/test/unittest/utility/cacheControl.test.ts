/**
 * cacheControl.test.ts - createCacheControlMiddleware のユニットテスト
 *
 * ## デシジョンテーブル（createCacheControlMiddleware）
 *
 * | #    | method | res.ok | 期待結果                                              |
 * |------|--------|--------|-------------------------------------------------------|
 * | T-01 | GET    | true   | Cache-Control ヘッダーを設定する                     |
 * | T-02 | POST   | true   | ヘッダーを設定しない（GET以外）                       |
 * | T-03 | GET    | false  | ヘッダーを設定しない（2xx以外）                       |
 * | T-04 | GET    | true   | next() を待ってからヘッダーを設定する                 |
 */
import 'reflect-metadata';

import { describe, expect, it, type Mock, mock } from 'bun:test';
import type { Context, Next } from 'hono';

import { createCacheControlMiddleware } from '../../../src/utility/cacheControl';

interface MockContext {
    req: { method: string };
    res: {
        ok: boolean;
        headers: { set: Mock<(name: string, value: string) => void> };
    };
}

const createMockContext = (method: string, ok: boolean): MockContext => ({
    req: { method },
    res: { ok, headers: { set: mock(() => {}) } },
});

describe('createCacheControlMiddleware', () => {
    it('createCacheControlMiddleware_GETかつ2xx_CacheControlヘッダーを設定すること', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(60, 300);
        const c = createMockContext('GET', true);
        const next: Next = mock(async () => {});

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(c.res.headers.set).toHaveBeenCalledWith(
            'Cache-Control',
            'public, max-age=60, s-maxage=300',
        );
    });

    it('createCacheControlMiddleware_POST_ヘッダーを設定しないこと', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(60, 300);
        const c = createMockContext('POST', true);
        const next: Next = mock(async () => {});

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(c.res.headers.set).not.toHaveBeenCalled();
    });

    it('createCacheControlMiddleware_GETだが2xx以外_ヘッダーを設定しないこと', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(60, 300);
        const c = createMockContext('GET', false);
        const next: Next = mock(async () => {});

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(c.res.headers.set).not.toHaveBeenCalled();
    });

    it('createCacheControlMiddleware_next完了後にヘッダーを設定すること', async () => {
        // Arrange
        const middleware = createCacheControlMiddleware(10, 20);
        const c = createMockContext('GET', true);
        const order: string[] = [];
        const next: Next = mock(async () => {
            order.push('next');
        });
        c.res.headers.set = mock(() => {
            order.push('set');
        });

        // Act
        await middleware(c as unknown as Context, next);

        // Assert
        expect(order).toEqual(['next', 'set']);
    });
});
