/**
 * place.upsert.controller.usecase.repository.component.test.ts
 *
 * PLACE-UPSERT-1 ~ PLACE-UPSERT-2: POST /place エンドポイントのコンポーネントテスト（BEHAV-001）。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemory D1（Drizzle）
 *
 * `place.get...component.test.ts` と同じ方針（controllerを直接呼ばずrouter経由の実HTTP、
 * 配線1パターンにつき代表1本）。エンティティ単位の検証ルールの網羅（JRAはplaceHeldDays必須等）は
 * core の `placeUpsertValidation.test.ts` に担保させ、ここでは
 * 「実HTTP POST → 認証ミドルウェア通過 → 検証 → DB永続化 → レスポンス」の配線のみを確認する。
 *
 * ## シナリオテーブル（Place POST Router → Controller → Usecase → Repository → InMemory D1）
 *
 * | #               | リクエスト条件                                    | 期待                                              |
 * |------------------|-----------------------------------------------------|-----------------------------------------------------|
 * | PLACE-UPSERT-1   | 認証ヘッダーあり・NAR1件（正当なボディ）           | 200・successCount=1・DBに1行永続化される            |
 * | PLACE-UPSERT-2   | 認証ヘッダー無し                                    | 401（`requireServiceAuth`で拒否・DBに書き込まれない）|
 * | PLACE-UPSERT-3   | 認証ヘッダーあり・空配列（バリデーションエラー）    | 400・DBに書き込まれない（BEHAV-002）                 |
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
import {
    RaceType,
    SERVICE_AUTH_HEADER,
    type UpsertResult,
} from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

/** NAR の有効なアップサート入力（placeHeldDays/placeGrade不要で最小構成） */
const VALID_NAR_ITEM = {
    placeId: 'nar2026012701',
    locationCode: '01',
    raceType: RaceType.NAR,
    datetime: '2026-01-27T00:00:00+09:00',
    raceCourse: '北見ば',
};

describe('コンポーネントテスト: Place POST Router → Controller → Usecase → Repository → InMemory D1', () => {
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

    it('PLACE-UPSERT-1: 認証ヘッダーあり_NAR1件を永続化しsuccessCountを返すこと', async () => {
        // Act
        const response = await requestApi(d1, '/place', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify([VALID_NAR_ITEM]),
        });
        const body = (await response.json()) as UpsertResult;

        // Assert
        expect(response.status).toBe(200);
        expect(body.successCount).toBe(1);
        expect(body.failureCount).toBe(0);

        const rows = await db.select().from(schema.place);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.placeId).toBe(VALID_NAR_ITEM.placeId);
    });

    it('PLACE-UPSERT-2: 認証ヘッダー無し_401を返しDBに書き込まれないこと', async () => {
        // Act
        const response = await requestApi(d1, '/place', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([VALID_NAR_ITEM]),
        });

        // Assert
        expect(response.status).toBe(401);
        const rows = await db.select().from(schema.place);
        expect(rows).toHaveLength(0);
    });

    it('PLACE-UPSERT-3: 認証ヘッダーあり_空配列は400を返しDBに書き込まれないこと', async () => {
        // Act
        const response = await requestApi(d1, '/place', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify([]),
        });

        // Assert
        expect(response.status).toBe(400);
        const rows = await db.select().from(schema.place);
        expect(rows).toHaveLength(0);
    });
});
