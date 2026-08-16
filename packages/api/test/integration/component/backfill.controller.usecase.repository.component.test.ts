/**
 * backfill.controller.usecase.repository.component.test.ts
 *
 * BACKFILL-1 ~ BACKFILL-3: POST /internal/backfill/place・POST /internal/backfill/race
 * エンドポイントのコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → BackfillController → BackfillUsecase →
 *   (place backfill) BackfillRepository → ScrapingApiGateway（fetchをモック）
 *   (race backfill)   PlaceRepository（InMemory D1） + BackfillRepository → ScrapingApiGateway
 *
 * `packages/admin`からのみサービス間認証（`X-Service-Auth-Token`）経由で呼ばれる
 * 保護対象エンドポイントであること、race backfillが自身のD1からplaceIdを解決して
 * scraping Workerへ委譲すること、の配線を確認する（詳細なロジック網羅はUTに譲る）。
 *
 * ## シナリオテーブル
 *
 * | #           | 事前状態                 | リクエスト                              | 期待                                                        |
 * |--------------|---------------------------|-------------------------------------------|---------------------------------------------------------------|
 * | BACKFILL-1   | -                         | POST /internal/backfill/place（認証あり）| 200・scraping /sync/place がcacheOnly:true付きで1回呼ばれる  |
 * | BACKFILL-2   | D1にKEIRIN place 1件      | POST /internal/backfill/race（認証あり） | 200・scraping /sync/race がそのplaceIdを含むボディで1回呼ばれる |
 * | BACKFILL-3   | D1に対象期間のplaceが0件  | POST /internal/backfill/race（認証あり） | 200・scraping /sync/race は呼ばれない（notCachedPlaceIds等は空）|
 */

import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    mock,
} from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { RaceType, SERVICE_AUTH_HEADER } from '@race-schedule/core';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

/** KEIRIN の有効なアップサート入力（machine式のためplaceGrade必須） */
const VALID_KEIRIN_ITEM = {
    placeId: 'keirin2026012711',
    locationCode: '11',
    raceType: RaceType.KEIRIN,
    datetime: '2026-01-27T00:00:00+09:00',
    raceCourse: '弥彦',
    placeGrade: 'GⅠ',
};

describe('コンポーネントテスト: Backfill Router → Controller → Usecase → Repository', () => {
    let d1: D1Database;
    const originalFetch = globalThis.fetch;

    beforeAll(() => {
        useInMemoryDB();
    });

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        setupGlobalMocks(d1);
        process.env.SCRAPING_API_URL = 'https://scraping.example.com';
    });

    afterEach(() => {
        container.clearInstances();
        globalThis.fetch = originalFetch;
        delete process.env.SCRAPING_API_URL;
    });

    const mockScrapingFetch = (
        body: Record<string, unknown>,
    ): { calls: { url: string; init?: RequestInit }[] } => {
        const calls: { url: string; init?: RequestInit }[] = [];
        globalThis.fetch = mock((url: string, init?: RequestInit) => {
            calls.push({ url, init });
            return Promise.resolve(
                new Response(JSON.stringify(body), { status: 200 }),
            );
        }) as unknown as typeof fetch;
        return { calls };
    };

    it('BACKFILL-1: POST /internal/backfill/place はサービス間認証付きでscraping /sync/placeへcacheOnly:trueで委譲すること', async () => {
        const { calls } = mockScrapingFetch({
            successCount: 0,
            failureCount: 0,
            failures: [],
            notCachedKeys: [],
        });

        const response = await requestApi(d1, '/internal/backfill/place', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify({
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
                raceTypeList: ['keirin'],
            }),
        });

        expect(response.status).toBe(200);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toBe('https://scraping.example.com/sync/place');
        const sentBody = JSON.parse(calls[0]?.init?.body as string) as {
            cacheOnly: boolean;
        };
        expect(sentBody.cacheOnly).toBe(true);
    });

    it('BACKFILL-2: POST /internal/backfill/race はD1から解決したplaceIdでscraping /sync/raceへ委譲すること', async () => {
        // Arrange: D1へKEIRINのplaceを1件永続化する
        const upsertResponse = await requestApi(d1, '/place', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify([VALID_KEIRIN_ITEM]),
        });
        expect(upsertResponse.status).toBe(200);

        const { calls } = mockScrapingFetch({
            successCount: 0,
            failureCount: 0,
            failures: [],
            notCachedPlaceIds: [],
        });

        // Act
        const response = await requestApi(d1, '/internal/backfill/race', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify({
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
                raceTypeList: ['keirin'],
            }),
        });

        // Assert
        expect(response.status).toBe(200);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toBe('https://scraping.example.com/sync/race');
        const sentBody = JSON.parse(calls[0]?.init?.body as string) as {
            placeIdList: string[];
            cacheOnly: boolean;
        };
        expect(sentBody.placeIdList).toEqual([VALID_KEIRIN_ITEM.placeId]);
        expect(sentBody.cacheOnly).toBe(true);
    });

    it('BACKFILL-3: POST /internal/backfill/race は対象placeが0件の場合scraping Workerを呼ばないこと', async () => {
        const { calls } = mockScrapingFetch({
            successCount: 0,
            failureCount: 0,
            failures: [],
            notCachedPlaceIds: [],
        });

        const response = await requestApi(d1, '/internal/backfill/race', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify({
                startDate: '2026-01-01',
                finishDate: '2026-01-31',
                raceTypeList: ['keirin'],
            }),
        });

        expect(response.status).toBe(200);
        expect(calls).toHaveLength(0);
        const responseBody = (await response.json()) as {
            notCachedPlaceIds: string[];
        };
        expect(responseBody.notCachedPlaceIds).toEqual([]);
    });
});
