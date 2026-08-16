/**
 * debug.controller.usecase.repository.component.test.ts
 *
 * DEBUG-1: GET /debug/database エンドポイントのコンポーネントテスト（BEHAV-015）。
 *
 * 層構造: Router（実HTTP） → DebugController → DebugUsecase → DebugRepository → InMemory D1（Drizzle）
 *
 * `isUseInMemoryDB` が true（`USE_IN_MEMORY_DB='true'`、`buildMockHonoEnv` 既定値）の場合のみ
 * 実処理する設計（本番D1では認証なしでDB件数が露出するため）。認証を持たない
 * 非本番限定エンドポイントであるため `SERVICE_AUTH_EXEMPT_ROUTES` には含まれず、
 * かつ in-memory 判定自体が多層防御として機能する。
 *
 * ## シナリオテーブル
 *
 * | #        | 事前状態          | リクエスト条件                    | 期待                              |
 * |-----------|---------------------|--------------------------------------|-------------------------------------|
 * | DEBUG-1   | race 1件登録済み    | 認証ヘッダーあり・in-memory DB       | 200・success:true・raceCount=1     |
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
import { RaceType, SERVICE_AUTH_HEADER } from '@race-schedule/core';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_SERVICE_AUTH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

describe('コンポーネントテスト: Debug GET Router → Controller → Usecase → Repository → InMemory D1', () => {
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

    it('DEBUG-1: race 1件登録済み_件数を返すこと', async () => {
        // Arrange
        await db.insert(schema.race).values({
            raceId: 'jra202601270501',
            placeId: 'jra2026012705',
            raceType: RaceType.JRA,
            dateTime: '2026-01-27T00:00:00+09:00',
            locationCode: '05',
            raceName: '有馬記念',
            raceNumber: 1,
        });

        // Act
        const response = await requestApi(d1, '/debug/database', {
            headers: { [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN },
        });
        const body = (await response.json()) as {
            success: boolean;
            raceCount: number;
        };

        // Assert
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.raceCount).toBe(1);
    });
});
