/**
 * favorite.controller.usecase.repository.component.test.ts
 *
 * お気に入りレース（user単位、段階2）のコンポーネントテスト。
 *
 * 層構造: Router（実HTTP） → FavoriteController → FavoriteUsecase → FavoriteRepository → InMemory D1（Drizzle）
 *
 * ## シナリオテーブル
 *
 * | #          | 事前状態             | リクエスト                | 期待                       |
 * |-------------|------------------------|------------------------------|------------------------------|
 * | FAVORITE-1  | 未登録                 | GET /favorite                | 200・raceIds:[]              |
 * | FAVORITE-2  | -                      | POST /favorite（raceId追加） | 200・以後GETに反映される      |
 * | FAVORITE-3  | FAVORITE-2で追加済み   | DELETE /favorite（raceId削除）| 200・以後GETから消える       |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { requestApi } from '../../common/requestApi';
import { insertTestSession } from '../../common/sessionAuth';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

describe('コンポーネントテスト: Favorite Router → Controller → Usecase → Repository → InMemory D1', () => {
    let d1: D1Database;
    let sessionHeaders: Record<string, string>;

    beforeEach(async () => {
        d1 = createInMemoryD1Database();
        setupGlobalMocks(d1);
        sessionHeaders = await insertTestSession(drizzle(d1, { schema }));
    });

    afterEach(() => {
        container.clearInstances();
    });

    const fetchFavorites = () =>
        requestApi(d1, '/favorite', { headers: sessionHeaders });

    it('FAVORITE-1: 未登録の場合GETは空配列を返すこと', async () => {
        const response = await fetchFavorites();
        const body = (await response.json()) as { raceIds: string[] };

        expect(response.status).toBe(200);
        expect(body.raceIds).toEqual([]);
    });

    it('FAVORITE-2: POSTで追加した後はGETに反映されること', async () => {
        const postRes = await requestApi(d1, '/favorite', {
            method: 'POST',
            headers: { ...sessionHeaders, 'content-type': 'application/json' },
            body: JSON.stringify({ raceId: 'jra202604260501' }),
        });
        expect(postRes.status).toBe(200);

        const response = await fetchFavorites();
        const body = (await response.json()) as { raceIds: string[] };
        expect(body.raceIds).toEqual(['jra202604260501']);
    });

    it('FAVORITE-3: DELETEで削除した後はGETから消えること', async () => {
        await requestApi(d1, '/favorite', {
            method: 'POST',
            headers: { ...sessionHeaders, 'content-type': 'application/json' },
            body: JSON.stringify({ raceId: 'jra202604260501' }),
        });

        const deleteRes = await requestApi(d1, '/favorite', {
            method: 'DELETE',
            headers: { ...sessionHeaders, 'content-type': 'application/json' },
            body: JSON.stringify({ raceId: 'jra202604260501' }),
        });
        expect(deleteRes.status).toBe(200);

        const response = await fetchFavorites();
        const body = (await response.json()) as { raceIds: string[] };
        expect(body.raceIds).toEqual([]);
    });
});
