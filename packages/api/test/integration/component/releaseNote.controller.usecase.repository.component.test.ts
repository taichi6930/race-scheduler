/**
 * releaseNote.controller.usecase.repository.component.test.ts
 *
 * RELEASE-NOTE-1/2: GET /release-notes エンドポイントのコンポーネントテスト
 * （更新履歴、What's New画面）。
 *
 * 層構造: Router（実HTTP） → ReleaseNoteController → ReleaseNoteUsecase →
 * ReleaseNoteRepository → DrizzleGateway → D1
 *
 * `GET /release-notes` は `SERVICE_AUTH_EXEMPT_ROUTES` に登録済みの公開エンドポイントのため、
 * 認証ヘッダー無しで到達できることも合わせて検証する。`POST /release-notes` は
 * `X-Service-Auth-Token`（`scripts/release/autoRelease.ts`専用）を要求する。
 *
 * ## シナリオテーブル
 *
 * | #                | リクエスト                          | 期待                                      |
 * |--------------------|----------------------------------------|---------------------------------------------|
 * | RELEASE-NOTE-1    | データ無しで認証ヘッダー無しGET       | 200・空配列                                |
 * | RELEASE-NOTE-2    | race-schedule/race-scheduler混在で投入後にGET | 200・race-schedulerのみ・published_atの新しい順 |
 * | RELEASE-NOTE-3    | 認証ヘッダー無しでPOST                | 401                                          |
 * | RELEASE-NOTE-4    | 正しいトークンでPOST（新規）→GET      | 201・GETに反映される                        |
 * | RELEASE-NOTE-5    | 同じtag_name-source_repoで再度POST    | 上書きされ、GETでは1件のまま                |
 * | RELEASE-NOTE-6    | 認証ヘッダー無しで /internal/release-notes へGET | 401                              |
 * | RELEASE-NOTE-7    | 正しいトークンで /internal/release-notes へGET   | 200・race-schedule分も含む全件      |
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import type { ReleaseNote, ReleaseNoteWrite } from '@race-schedule/core';
import { SERVICE_AUTH_HEADER } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

describe('コンポーネントテスト: ReleaseNote Router → Controller → Usecase → Repository → InMemory D1', () => {
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('RELEASE-NOTE-1: データ無し・認証ヘッダー無しでGETした場合は200・空配列を返すこと', async () => {
        const response = await requestApi(d1, '/release-notes');
        const body = (await response.json()) as ReleaseNote[];

        expect(response.status).toBe(200);
        expect(body).toEqual([]);
    });

    it('RELEASE-NOTE-2: race-schedule/race-scheduler混在で投入後にGETした場合は200・race-schedulerのみ新しい順で返すこと', async () => {
        await db.insert(schema.releaseNote).values([
            {
                tagName: 'v1.0.0',
                name: 'v1.0.0',
                body: '非公開リポジトリの古いリリース',
                publishedAt: '2026-01-01T00:00:00Z',
                sourceRepo: 'race-schedule',
            },
            {
                tagName: 'v2.0.0',
                name: 'v2.0.0',
                body: '新しいリリース',
                publishedAt: '2026-08-16T00:00:00Z',
                sourceRepo: 'race-scheduler',
            },
            {
                tagName: 'v1.9.0',
                name: 'v1.9.0',
                body: '公開リポジトリの少し古いリリース',
                publishedAt: '2026-07-01T00:00:00Z',
                sourceRepo: 'race-scheduler',
            },
        ]);

        const response = await requestApi(d1, '/release-notes');
        const body = (await response.json()) as ReleaseNote[];

        expect(response.status).toBe(200);
        // race-schedule（非公開）由来のv1.0.0は含まれない
        expect(body.map((r) => r.tag_name)).toEqual(['v2.0.0', 'v1.9.0']);
        expect(body[0]).toEqual({
            tag_name: 'v2.0.0',
            name: 'v2.0.0',
            body: '新しいリリース',
            published_at: '2026-08-16T00:00:00Z',
            draft: false,
            prerelease: false,
            source_repo: 'race-scheduler',
        });
    });

    it('RELEASE-NOTE-3: 認証ヘッダー無しでPOSTした場合は401を返すこと', async () => {
        const response = await requestApi(d1, '/release-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        expect(response.status).toBe(401);
    });

    it('RELEASE-NOTE-4: 正しいトークンでPOSTした場合は201を返し、GETに反映されること', async () => {
        const note: ReleaseNoteWrite = {
            tag_name: 'v2.0.0',
            name: 'v2.0.0',
            body: '本文',
            published_at: '2026-08-16T00:00:00Z',
            draft: false,
            prerelease: false,
            source_repo: 'race-scheduler',
        };

        const postResponse = await requestApi(d1, '/release-notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify(note),
        });

        expect(postResponse.status).toBe(201);

        const getResponse = await requestApi(d1, '/release-notes');
        const body = (await getResponse.json()) as ReleaseNote[];
        expect(body).toEqual([
            {
                tag_name: 'v2.0.0',
                name: 'v2.0.0',
                body: '本文',
                published_at: '2026-08-16T00:00:00Z',
                draft: false,
                prerelease: false,
                source_repo: 'race-scheduler',
            },
        ]);
    });

    it('RELEASE-NOTE-5: 同じtag_name-source_repoで再度POSTした場合は上書きされ1件のまま保たれること', async () => {
        const note: ReleaseNoteWrite = {
            tag_name: 'v2.0.0',
            name: 'v2.0.0',
            body: '初版',
            published_at: '2026-08-16T00:00:00Z',
            draft: false,
            prerelease: false,
            source_repo: 'race-scheduler',
        };
        const headers = {
            'Content-Type': 'application/json',
            [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
        };
        await requestApi(d1, '/release-notes', {
            method: 'POST',
            headers,
            body: JSON.stringify(note),
        });

        await requestApi(d1, '/release-notes', {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...note, body: '更新後の本文' }),
        });

        const getResponse = await requestApi(d1, '/release-notes');
        const body = (await getResponse.json()) as ReleaseNote[];
        expect(body).toHaveLength(1);
        expect(body[0]?.body).toBe('更新後の本文');
    });

    it('RELEASE-NOTE-6: 認証ヘッダー無しで/internal/release-notesへGETした場合は401を返すこと', async () => {
        const response = await requestApi(d1, '/internal/release-notes');

        expect(response.status).toBe(401);
    });

    it('RELEASE-NOTE-7: 正しいトークンで/internal/release-notesへGETした場合はrace-schedule分も含む全件を返すこと', async () => {
        await db.insert(schema.releaseNote).values([
            {
                tagName: 'v1.0.0',
                name: 'v1.0.0',
                body: '非公開リポジトリのリリース',
                publishedAt: '2026-01-01T00:00:00Z',
                sourceRepo: 'race-schedule',
            },
            {
                tagName: 'v2.0.0',
                name: 'v2.0.0',
                body: '公開リポジトリのリリース',
                publishedAt: '2026-08-16T00:00:00Z',
                sourceRepo: 'race-scheduler',
            },
        ]);

        const response = await requestApi(d1, '/internal/release-notes', {
            headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
        });
        const body = (await response.json()) as ReleaseNote[];

        expect(response.status).toBe(200);
        expect(body.map((r) => r.tag_name)).toEqual(['v2.0.0', 'v1.0.0']);
    });
});
