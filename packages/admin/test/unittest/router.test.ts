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
 * | T-17 | GET /invite       | 正常系           | 200・HTML（<!doctype html>を含む）             |
 * | T-18 | POST /invite/api  | 正常なボディ     | 201 + {token, inviteUrl}                       |
 * | T-19 | GET /participants | 正常系           | 200・HTML（<!doctype html>を含む）             |
 * | T-20 | GET /participants/api | 正常系       | 200 + {participants}                           |
 * | T-21 | POST /join-requests/api/:id/approve | 正常なid | 200（承認）                       |
 * | T-22 | POST /join-requests/api/:id/reject  | 正常なid | 200（却下）                       |
 * | T-23 | POST /join-requests/api/:id/approve | Honoのparam('id')がundefined | 400（idガードのフェイルクローズ） |
 * | T-24 | POST /join-requests/api/:id/reject  | Honoのparam('id')がundefined | 400（idガードのフェイルクローズ） |
 */

import 'reflect-metadata';

import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { DI_TOKENS } from '@race-schedule/core';
import { Hono } from 'hono';
import { HonoRequest } from 'hono/request';
import { container } from 'tsyringe';

import { setupDI } from '../../src/di';
import type { IMainApiGateway } from '../../src/gateway/interface/IMainApiGateway';
import { registerErrorHandlers, router } from '../../src/router';

/**
 * `HonoRequest.prototype.param`を1回だけundefinedに差し替える。
 * `param`はHonoのルート文字列リテラル型に依存した複雑なオーバーロード型を持ち、
 * `mockReturnValueOnce`へ直接`undefined`を渡すと型エラーになるため、
 * `unknown`経由の変換に一度だけ閉じ込める。
 * @returns スタブを解除するための`mockRestore`を持つスパイ
 */
const stubHonoParamUndefinedOnce = (): { mockRestore: () => void } =>
    spyOn(HonoRequest.prototype, 'param').mockReturnValueOnce(
        undefined as unknown as ReturnType<HonoRequest['param']>,
    );

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
            fetchReleaseNotes: () => Promise.resolve([]),
            issueInvite: () => Promise.resolve({ token: 'invite-token' }),
            fetchParticipants: () => Promise.resolve([]),
            fetchJoinRequests: () => Promise.resolve([]),
            approveJoinRequest: () => Promise.resolve(),
            rejectJoinRequest: () => Promise.resolve(),
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

    it('T-17: GET /inviteは200とHTMLを返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/invite'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });

    it('T-18: POST /invite/apiは正常なボディで201と{token, inviteUrl}を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/invite/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memo: 'テスト用' }),
            }),
        );

        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            token: string;
            inviteUrl: string;
        };
        expect(body.token).toBe('invite-token');
        expect(body.inviteUrl).toBe('/#/invite/invite-token');
    });

    it('T-19: GET /participantsは200とHTMLを返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/participants'),
        );

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toContain('<!doctype html>');
    });

    it('T-20: GET /participants/apiは200と{participants}を返す', async () => {
        const response = await router.fetch(
            new Request('http://localhost:8790/participants/api'),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { participants: unknown[] };
        expect(body.participants).toEqual([]);
    });

    it('T-21: POST /join-requests/api/:id/approveは正常なidで200を返す', async () => {
        const response = await router.fetch(
            new Request(
                'http://localhost:8790/join-requests/api/req-1/approve',
                { method: 'POST' },
            ),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
    });

    it('T-22: POST /join-requests/api/:id/rejectは正常なidで200を返す', async () => {
        const response = await router.fetch(
            new Request(
                'http://localhost:8790/join-requests/api/req-1/reject',
                { method: 'POST' },
            ),
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as { ok: boolean };
        expect(body.ok).toBe(true);
    });

    /**
     * Honoの`:id`ルーティングは空セグメントにマッチしないため、実際のHTTPリクエスト
     * だけでは`if (!id) return badRequest(...)`のtrue側（ガード発火）を再現できない。
     * `HonoRequest.prototype.param`を一時的にスタブし、ルーティング自体は正常なパスで
     * 通過させた上でハンドラ内の戻り値だけをundefinedに差し替えることで、
     * `c.req.param()`の型（`string | undefined`）が示すとおりのフェイルクローズ分岐を
     * 直接検証する。
     */
    it('T-23: POST /join-requests/api/:id/approveはparamがundefinedのとき400を返す', async () => {
        const paramSpy = stubHonoParamUndefinedOnce();
        const response = await router.fetch(
            new Request(
                'http://localhost:8790/join-requests/api/placeholder/approve',
                { method: 'POST' },
            ),
        );
        paramSpy.mockRestore();

        expect(response.status).toBe(400);
    });

    it('T-24: POST /join-requests/api/:id/rejectはparamがundefinedのとき400を返す', async () => {
        const paramSpy = stubHonoParamUndefinedOnce();
        const response = await router.fetch(
            new Request(
                'http://localhost:8790/join-requests/api/placeholder/reject',
                { method: 'POST' },
            ),
        );
        paramSpy.mockRestore();

        expect(response.status).toBe(400);
    });
});
