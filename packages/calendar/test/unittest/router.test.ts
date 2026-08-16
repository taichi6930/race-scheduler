/**
 * Calendar Router テスト
 *
 * @spec SPEC-API-001
 *
 * ## デシジョンテーブル
 *
 * | #   | パス/メソッド | 条件            | 期待結果                          |
 * |-----|----------------|------------------|-------------------------------------|
 * | T-01 | GET /health   | 正常系           | 200 `{ status: 'ok', package: 'calendar' }`（QAPI-06） |
 * | T-02 | GET /health   | 正常系           | CORSヘッダが設定されている          |
 * | T-03 | GET /not-found | 存在しないパス  | 404                                 |
 * | T-04 | POST /sync    | 不正なボディ     | 400                                  |
 * | T-05 | POST /sync    | container.resolve失敗 | 500                            |
 */

import 'reflect-metadata';

import { beforeEach, describe, expect, it } from 'bun:test';
import { isExempt, SERVICE_AUTH_HEADER } from '@race-schedule/core';
import { container } from 'tsyringe';

import { setupDI } from '../../src/di';
import { router, SERVICE_AUTH_EXEMPT_ROUTES } from '../../src/router';

const MOCK_SERVICE_AUTH_TOKEN = 'mock-service-auth-token';

describe('Calendar Router', () => {
    beforeEach(() => {
        process.env.CORS_ALLOWED_ORIGINS = '*';
        process.env.SERVICE_AUTH_TOKEN = MOCK_SERVICE_AUTH_TOKEN;
        setupDI();
    });

    it('T-01_GET /health_200とテキストを返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8788/health', {
                method: 'GET',
                headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
            }),
        );

        expect(response.status).toBe(200);
        // QAPI-06: 4 Worker横断でJSON形状を揃える
        const body = (await response.json()) as {
            status: string;
            package: string;
        };
        expect(body).toEqual({
            status: 'ok',
            package: 'calendar',
        });
    });

    it('T-02_GET /health_CORSヘッダが設定されている', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8788/health', {
                method: 'GET',
                headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
            }),
        );

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('T-03_GET /not-found_404を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8788/not-found', {
                method: 'GET',
                headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
            }),
        );

        expect(response.status).toBe(404);
    });

    it('T-04_POST /sync_不正なボディで400を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8788/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
                },
                body: JSON.stringify({}),
            }),
        );

        expect(response.status).toBe(400);
    });

    it('T-05_POST /sync_container.resolveが失敗する場合は500を返す', async () => {
        container.reset();
        const request = new Request('http://localhost:8788/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify({
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
                raceTypeList: ['jra'],
            }),
        });

        try {
            const response = await router.fetch(request);
            expect(response.status).toBe(500);
        } finally {
            setupDI();
        }
    });
});

/**
 * サービス間認証: ルート分類の回帰防止テスト（SECAUTH-09）
 *
 * calendar の免除は `GET /health` と `OPTIONS *` のみ（他はすべて保護対象）。
 * `router.routes` の実ハンドラルートを固定リストと突き合わせ、新しいルートを
 * 追加したときに分類を忘れるとこのテストが落ちる。
 */
describe('サービス間認証: ルート分類の回帰防止（SECAUTH-09）', () => {
    beforeEach(() => {
        process.env.CORS_ALLOWED_ORIGINS = '*';
        process.env.SERVICE_AUTH_TOKEN = MOCK_SERVICE_AUTH_TOKEN;
        setupDI();
    });

    const concreteRoutes = router.routes.filter(
        (route) => route.method !== 'ALL' && !route.path.endsWith('/*'),
    );

    const routeKey = (route: { method: string; path: string }): string =>
        `${route.method} ${route.path}`;

    const EXPECTED_EXEMPT_ROUTE_KEYS = ['GET /health'];

    const EXPECTED_PROTECTED_ROUTE_KEYS = ['POST /sync'];

    it('ルート一覧が想定どおりに分類されていること（免除リスト+保護対象=登録済み全ルート）', () => {
        const actualKeys = new Set(concreteRoutes.map(routeKey));
        const expectedKeys = new Set([
            ...EXPECTED_EXEMPT_ROUTE_KEYS,
            ...EXPECTED_PROTECTED_ROUTE_KEYS,
        ]);

        expect(actualKeys).toEqual(expectedKeys);
    });

    it.each(EXPECTED_EXEMPT_ROUTE_KEYS.map((key) => [key] as const))(
        '免除ルート %s は SERVICE_AUTH_EXEMPT_ROUTES 上で免除と判定されること',
        (key) => {
            const [method, path] = key.split(' ');
            expect(isExempt(method, path, SERVICE_AUTH_EXEMPT_ROUTES)).toBe(
                true,
            );
        },
    );

    it.each(EXPECTED_PROTECTED_ROUTE_KEYS.map((key) => [key] as const))(
        '保護対象ルート %s は SERVICE_AUTH_EXEMPT_ROUTES 上で非免除と判定されること',
        (key) => {
            const [method, path] = key.split(' ');
            expect(isExempt(method, path, SERVICE_AUTH_EXEMPT_ROUTES)).toBe(
                false,
            );
        },
    );

    it('主要な保護ルート（POST /sync）はトークン無しで401になること', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8788/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }),
        );

        expect(response.status).toBe(401);
    });

    it('公開ルート（GET /health）はトークン無しでも200系になること', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8788/health', { method: 'GET' }),
        );

        expect(response.status).toBeLessThan(300);
    });
});
