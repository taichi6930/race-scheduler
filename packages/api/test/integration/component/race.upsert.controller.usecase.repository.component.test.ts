/**
 * race.upsert.controller.usecase.repository.component.test.ts
 *
 * RACE-UPSERT-1 ~ RACE-UPSERT-2: POST /race エンドポイントのコンポーネントテスト（BEHAV-003）。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemory D1（Drizzle）
 *
 * `place.upsert...component.test.ts` と同じ方針。エンティティ単位の検証ルールの網羅は
 * core の `raceUpsertValidation.test.ts` に担保させ、ここでは
 * 「実HTTP POST → 認証ミドルウェア通過 → 検証 → DB永続化 → レスポンス」の配線のみを確認する。
 *
 * ## シナリオテーブル（Race POST Router → Controller → Usecase → Repository → InMemory D1）
 *
 * | #              | リクエスト条件                          | 期待                                              |
 * |-----------------|--------------------------------------------|-----------------------------------------------------|
 * | RACE-UPSERT-1   | 認証ヘッダーあり・KEIRIN1件（正当なボディ）| 200・successCount=1・DBに1行永続化される            |
 * | RACE-UPSERT-2   | 認証ヘッダー無し                            | 401（`requireServiceAuth`で拒否・DBに書き込まれない）|
 * | RACE-UPSERT-3   | 認証ヘッダーあり・空配列（バリデーションエラー）| 400・DBに書き込まれない（BEHAV-004）             |
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

/** KEIRIN の有効なアップサート入力（conditionData不要で最小構成） */
const VALID_KEIRIN_ITEM = {
    raceId: 'keirin202601271101',
    placeId: 'keirin2026012711',
    raceType: RaceType.KEIRIN,
    datetime: '2026-01-27T00:00:00+09:00',
    locationCode: '11',
    raceCourse: '函館',
    raceName: 'グランプリ',
    raceGrade: 'GP',
    raceStage: 'S級決勝',
    raceNumber: 1,
};

describe('コンポーネントテスト: Race POST Router → Controller → Usecase → Repository → InMemory D1', () => {
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

    it('RACE-UPSERT-1: 認証ヘッダーあり_KEIRIN1件を永続化しsuccessCountを返すこと', async () => {
        // Act
        const response = await requestApi(d1, '/race', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify([VALID_KEIRIN_ITEM]),
        });
        const body = (await response.json()) as UpsertResult;

        // Assert
        expect(response.status).toBe(200);
        expect(body.successCount).toBe(1);
        expect(body.failureCount).toBe(0);

        const rows = await db.select().from(schema.race);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.raceId).toBe(VALID_KEIRIN_ITEM.raceId);
    });

    it('RACE-UPSERT-2: 認証ヘッダー無し_401を返しDBに書き込まれないこと', async () => {
        // Act
        const response = await requestApi(d1, '/race', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([VALID_KEIRIN_ITEM]),
        });

        // Assert
        expect(response.status).toBe(401);
        const rows = await db.select().from(schema.race);
        expect(rows).toHaveLength(0);
    });

    it('RACE-UPSERT-3: 認証ヘッダーあり_空配列は400を返しDBに書き込まれないこと', async () => {
        // Act
        const response = await requestApi(d1, '/race', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN,
            },
            body: JSON.stringify([]),
        });

        // Assert
        expect(response.status).toBe(400);
        const rows = await db.select().from(schema.race);
        expect(rows).toHaveLength(0);
    });
});
