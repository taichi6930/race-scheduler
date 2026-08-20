/**
 * player.upsert.controller.usecase.repository.component.test.ts
 *
 * PLAYER-UPSERT-1 ~ PLAYER-UPSERT-2: POST /player エンドポイントのコンポーネントテスト（BEHAV-005）。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemory D1（Drizzle）
 *
 * `place.upsert...component.test.ts` と同じ方針。snake_case→camelCase変換を含むエンティティ
 * 単位の検証ルールの網羅は core の `playerValidation.test.ts` に担保させ、ここでは
 * 「実HTTP POST → 認証ミドルウェア通過 → 検証 → DB永続化 → レスポンス」の配線のみを確認する。
 *
 * `POST /player` は `APP_AUTH_ROUTES` で `session-only`（router.ts、front招待制
 * クローズド化）のため、`insertTestSession`（`test/common/sessionAuth.ts`）でInMemory D1へ
 * 有効なuser/credential/sessionを直接投入し、Authorizationヘッダーを付与して呼ぶ
 * （旧`SERVICE_AUTH_EXEMPT_ROUTES`時代の「認証ヘッダーあり/無し」区別は、session-only化に
 * 伴いセッションヘッダー必須という単一の要件に統合された）。
 *
 * ## シナリオテーブル（Player POST Router → Controller → Usecase → Repository → InMemory D1）
 *
 * | #                | リクエスト条件                          | 期待                                              |
 * |-------------------|--------------------------------------------|-----------------------------------------------------|
 * | PLAYER-UPSERT-1   | セッション認証あり・1件（正当なボディ）    | 200・successCount=1・DBに1行永続化される            |
 * | PLAYER-UPSERT-2   | セッション認証あり・1件（正当なボディ、別ケース）| 200・successCount=1・DBに1行永続化される      |
 * | PLAYER-UPSERT-3   | セッション認証あり・空配列（バリデーションエラー）| 400・DBに書き込まれない（BEHAV-006）           |
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
import type { UpsertResult } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { requestApi } from '../../common/requestApi';
import { insertTestSession } from '../../common/sessionAuth';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

/** 有効なアップサート入力（snake_case、controller層で受け取るJSON形状） */
const VALID_PLAYER_ITEM = {
    race_type: 'jra',
    player_no: '1234',
    player_name: 'テスト太郎',
    priority: 1,
};

describe('コンポーネントテスト: Player POST Router → Controller → Usecase → Repository → InMemory D1', () => {
    let restoreEnv: () => void;
    let db: DrizzleD1Database<typeof schema>;
    let d1: D1Database;
    /** POST /player は session-only のため、テスト用セッションのAuthorizationヘッダー */
    let sessionHeaders: Record<string, string>;

    beforeAll(() => {
        restoreEnv = useInMemoryDB();
    });

    afterAll(() => {
        restoreEnv();
    });

    beforeEach(async () => {
        d1 = createInMemoryD1Database();
        db = drizzle(d1, { schema });
        setupGlobalMocks(d1);
        sessionHeaders = await insertTestSession(db);
    });

    afterEach(() => {
        container.clearInstances();
    });

    it('PLAYER-UPSERT-1: セッション認証あり_1件を永続化しsuccessCountを返すこと', async () => {
        // Act
        const response = await requestApi(d1, '/player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...sessionHeaders,
            },
            body: JSON.stringify([VALID_PLAYER_ITEM]),
        });
        const body = (await response.json()) as UpsertResult;

        // Assert
        expect(response.status).toBe(200);
        expect(body.successCount).toBe(1);
        expect(body.failureCount).toBe(0);

        const rows = await db.select().from(schema.player);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.playerName).toBe(VALID_PLAYER_ITEM.player_name);
    });

    it('PLAYER-UPSERT-2: 別ユーザーのセッション認証でも_1件を永続化しsuccessCountを返すこと', async () => {
        // Arrange: PLAYER-UPSERT-1とは別のuser/sessionでも通過することを確認する
        const otherSessionHeaders = await insertTestSession(db, {
            userId: 'test-user-2',
            token: 'mock-session-token-2',
        });

        // Act
        const response = await requestApi(d1, '/player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...otherSessionHeaders,
            },
            body: JSON.stringify([VALID_PLAYER_ITEM]),
        });
        const body = (await response.json()) as UpsertResult;

        // Assert
        expect(response.status).toBe(200);
        expect(body.successCount).toBe(1);
        expect(body.failureCount).toBe(0);

        const rows = await db.select().from(schema.player);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.playerName).toBe(VALID_PLAYER_ITEM.player_name);
    });

    it('PLAYER-UPSERT-3: セッション認証あり_空配列は400を返しDBに書き込まれないこと', async () => {
        // Act
        const response = await requestApi(d1, '/player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...sessionHeaders,
            },
            body: JSON.stringify([]),
        });

        // Assert
        expect(response.status).toBe(400);
        const rows = await db.select().from(schema.player);
        expect(rows).toHaveLength(0);
    });
});
