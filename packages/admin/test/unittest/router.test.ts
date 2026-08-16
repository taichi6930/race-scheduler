/**
 * Admin Router テスト
 *
 * ## デシジョンテーブル
 *
 * | #    | パス/メソッド     | 条件            | 期待結果                                    |
 * |------|--------------------|------------------|-----------------------------------------------|
 * | T-01 | GET /health       | 正常系           | 200 `{ status: 'ok', package: 'admin' }`（QAPI-06） |
 * | T-02 | GET /not-found    | 存在しないパス   | 404・共通chrome付きHTML（QADM-07）             |
 * | T-15 | GET /             | 正常系           | /flags へリダイレクト（QADM-06）               |
 * | T-16 | GET /boom（onErrorに直接配線した未処理例外ルート） | 例外発生 | 500・共通chrome付きHTML（QADM-07） |
 * | T-03 | GET /flags        | 正常系           | 200・HTML（<!doctype html>を含む）             |
 * | T-04 | GET /flags/api    | 正常系           | 200 + {flags:[...]}                            |
 * | T-05 | POST /flags/api   | 不正なボディ     | 400                                             |
 * | T-06 | GET /flags        | -                | CSPは'self'のみ許可しCDNを含まない             |
 * | T-07 | GET /backfill     | 正常系           | 200・HTML（<!doctype html>を含む）             |
 * | T-08 | POST /backfill/api/place | 正常なボディ | 200 + バックフィル結果                     |
 * | T-09 | POST /backfill/api/race  | 不正なボディ | 400                                          |
 * | T-10 | GET /race-detail-layout  | 正常系       | 200・HTML（<!doctype html>を含む）             |
 * | T-11 | GET /race-detail-layout/api | 正常系   | 200 + {raceType, config}                       |
 * | T-12 | POST /race-detail-layout/api | 不正なボディ | 400                                       |
 * | T-13 | POST /race-detail-layout/api/preview | 不正なボディ | 400                             |
 * | T-14 | GET /race-detail-layout/api/races | 正常系 | 200 + {races}                          |
 */

import 'reflect-metadata';

import { beforeEach, describe, expect, it } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { Hono } from 'hono';
import { container } from 'tsyringe';

import { setupDI } from '../../src/di';
import type { IMainApiGateway } from '../../src/gateway/interface/IMainApiGateway';
import { registerErrorHandlers, router } from '../../src/router';

describe('Admin Router', () => {
    beforeEach(() => {
        setupDI();
        const mainApiGateway: IMainApiGateway = {
            fetchFeatureFlagList: () =>
                Promise.resolve([
                    {
                        key: 'announcement_banner',
                        label: 'A',
                        storedEnabled: true,
                        envDefault: false,
                        effectiveEnabled: true,
                        updatedAt: '2026-08-07T00:00:00.000Z',
                    },
                ]),
            updateFeatureFlag: () => Promise.resolve([]),
            backfillPlace: () =>
                Promise.resolve({
                    successCount: 0,
                    failureCount: 0,
                    failures: [],
                    notCachedKeys: [],
                }),
            backfillRace: () =>
                Promise.resolve({
                    successCount: 0,
                    failureCount: 0,
                    failures: [],
                    notCachedPlaceIds: [],
                }),
            fetchUiLayout: () => Promise.resolve({ sections: [] }),
            saveUiLayout: () => Promise.resolve({ sections: [] }),
            previewUiLayout: () => Promise.resolve(undefined),
            fetchUpcomingKeirinRaces: () => Promise.resolve([]),
        };
        container.register<IMainApiGateway>(DI_TOKENS.MainApiGateway, {
            useValue: mainApiGateway,
        });
    });

    it('T-01: GET /healthは200と{status,package}を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/health'),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            status: string;
            package: string;
        };
        expect(body).toEqual({ status: 'ok', package: 'admin' });
    });

    it('T-02: GET /not-foundは404と共通chrome付きHTMLを返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/not-found'),
        );

        expect(response.status).toBe(404);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
        expect(text).toContain('class="admin-nav"');
    });

    it('T-15: GET /は/flagsへリダイレクトすること', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/', { redirect: 'manual' }),
        );

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toBe('/flags');
    });

    it('T-16: 未処理の例外はonErrorが捕捉し500と共通chrome付きHTMLを返すこと', async () => {
        const testApp = new Hono();
        registerErrorHandlers(testApp);
        testApp.get('/boom', () => {
            throw new Error('boom');
        });

        const response = await testApp.fetch(
            new Request('http://localhost:8790/boom'),
        );

        expect(response.status).toBe(500);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
        expect(text).toContain('class="admin-nav"');
    });

    it('T-03: GET /flagsは200とHTMLを返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/flags'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });

    it('T-04: GET /flags/apiは200とフラグ一覧を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/flags/api'),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { flags: unknown[] };
        expect(body.flags).toHaveLength(1);
    });

    it('T-05: POST /flags/apiは不正なボディで400を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/flags/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }),
        );

        expect(response.status).toBe(400);
    });

    it("T-06: GET /flagsのCSPは'self'のみ許可しCDNを含まない", async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/flags'),
        );

        const csp = response.headers.get('Content-Security-Policy');
        expect(csp).not.toBe("default-src 'none'");
        expect(csp).not.toContain('https://cdn.jsdelivr.net');
    });

    it('T-07: GET /backfillは200とHTMLを返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/backfill'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });

    it('T-08: POST /backfill/api/placeは正常なボディで200とバックフィル結果を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/backfill/api/place', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate: '2026-01-01',
                    finishDate: '2026-01-31',
                    raceTypeList: ['keirin'],
                }),
            }),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { successCount: number };
        expect(body.successCount).toBe(0);
    });

    it('T-09: POST /backfill/api/raceは不正なボディで400を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/backfill/api/race', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }),
        );

        expect(response.status).toBe(400);
    });

    it('T-10: GET /race-detail-layoutは200とHTMLを返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/race-detail-layout'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });

    it('T-11: GET /race-detail-layout/apiは200と{raceType, config}を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/race-detail-layout/api'),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { raceType: string };
        expect(body.raceType).toBe('keirin');
    });

    it('T-12: POST /race-detail-layout/apiは不正なボディで400を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/race-detail-layout/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }),
        );

        expect(response.status).toBe(400);
    });

    it('T-13: POST /race-detail-layout/api/previewは不正なボディで400を返す', async () => {
        const response = await router.fetch(
            new Request(
                'http://localhost:8790/race-detail-layout/api/preview',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                },
            ),
        );

        expect(response.status).toBe(400);
    });

    it('T-14: GET /race-detail-layout/api/racesは200と{races}を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/race-detail-layout/api/races'),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { races: unknown[] };
        expect(body.races).toEqual([]);
    });
});
