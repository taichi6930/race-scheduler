/**
 * calendarFlag.controller.usecase.repository.component.test.ts
 *
 * FLAG-1 ~ FLAG-6: GET/POST/DELETE /calendar/flag エンドポイントのコンポーネントテスト
 * （BEHAV-007/008/009）。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository(CalendarRepository) → InMemory D1（Drizzle）
 *
 * controller を直接呼ばず、本番と同じ `router`（Hono app）に実HTTPリクエストを送る
 * （`requestApi` ヘルパー経由）。「配線1パターンにつき代表1本」に絞り、フラグの
 * ラベル形式等の詳細検証は `calendarController.schemas.ts` 側のUTに委ねる。
 *
 * ## シナリオテーブル
 *
 * | #      | 事前状態             | リクエスト条件                              | 期待                                   |
 * |--------|-----------------------|------------------------------------------------|-----------------------------------------|
 * | FLAG-1 | フラグ1件登録済み     | 認証ヘッダーあり・GET /calendar/flag           | 200・count=1                            |
 * | FLAG-2 | 空                    | 認証ヘッダーあり・POST /calendar/flag           | 200・DBに1行追加される                  |
 * | FLAG-3 | 空                    | 認証ヘッダー無し・POST /calendar/flag           | 401・DBに書き込まれない                 |
 * | FLAG-4 | フラグ1件登録済み     | 認証ヘッダーあり・DELETE /calendar/flag         | 200・DBから削除される                   |
 * | FLAG-5 | フラグ1件登録済み     | 認証ヘッダー無し・DELETE /calendar/flag         | 401・DBから削除されない                 |
 * | FLAG-6 | 空                    | 認証ヘッダー無し・GET /calendar/flag           | 401                                     |
 */

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { SERVICE_AUTH_HEADER } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

const RACE_ID = 'jra202601270501';

const authHeaders = {
    'Content-Type': 'application/json',
    [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
};

describe('コンポーネントテスト: Calendar Flag Router → Controller → Usecase → Repository → InMemory D1', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;

    beforeAll(() => {
        restoreEnv = useInMemoryDB();
    });

    afterAll(() => {
        restoreEnv();
    });

    beforeEach(() => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('FLAG-1: 認証ヘッダーあり_登録済み1件をGETで取得できること', async () => {
        // Arrange
        await db.insert(schema.calendarFlag).values({ raceId: RACE_ID });

        // Act
        const response = await requestApi(d1, '/calendar/flag', {
            headers: authHeaders,
        });
        const body = (await response.json()) as { count: number };

        // Assert
        expect(response.status).toBe(200);
        expect(body.count).toBe(1);
    });

    it('FLAG-2: 認証ヘッダーあり_POSTでフラグを追加しDBに永続化されること', async () => {
        // Act
        const response = await requestApi(d1, '/calendar/flag', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ raceId: RACE_ID, label: 'お気に入り' }),
        });

        // Assert
        expect(response.status).toBe(200);
        const rows = await db.select().from(schema.calendarFlag);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.raceId).toBe(RACE_ID);
    });

    it('FLAG-3: 認証ヘッダー無し_POSTが401でDBに書き込まれないこと', async () => {
        // Act
        const response = await requestApi(d1, '/calendar/flag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raceId: RACE_ID }),
        });

        // Assert
        expect(response.status).toBe(401);
        const rows = await db.select().from(schema.calendarFlag);
        expect(rows).toHaveLength(0);
    });

    it('FLAG-4: 認証ヘッダーあり_DELETEでフラグがDBから削除されること', async () => {
        // Arrange
        await db.insert(schema.calendarFlag).values({ raceId: RACE_ID });

        // Act
        const response = await requestApi(d1, '/calendar/flag', {
            method: 'DELETE',
            headers: authHeaders,
            body: JSON.stringify({ raceId: RACE_ID }),
        });

        // Assert
        expect(response.status).toBe(200);
        const rows = await db.select().from(schema.calendarFlag);
        expect(rows).toHaveLength(0);
    });

    it('FLAG-5: 認証ヘッダー無し_DELETEが401でDBから削除されないこと', async () => {
        // Arrange
        await db.insert(schema.calendarFlag).values({ raceId: RACE_ID });

        // Act
        const response = await requestApi(d1, '/calendar/flag', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raceId: RACE_ID }),
        });

        // Assert
        expect(response.status).toBe(401);
        const rows = await db.select().from(schema.calendarFlag);
        expect(rows).toHaveLength(1);
    });

    it('FLAG-6: 認証ヘッダー無し_GETが401を返すこと', async () => {
        // Act
        const response = await requestApi(d1, '/calendar/flag', {
            headers: { 'Content-Type': 'application/json' },
        });

        // Assert
        expect(response.status).toBe(401);
    });
});
