/**
 * push.dispatch.controller.usecase.repository.component.test.ts
 *
 * PUSH-DISPATCH-1 ~ PUSH-DISPATCH-2: POST /push/dispatch エンドポイントの
 * コンポーネントテスト（BEHAV-014）。
 *
 * 層構造: Router（実HTTP） → Controller → Usecase → Repository → InMemory D1（Drizzle）
 *
 * `/push/dispatch` は `SERVICE_AUTH_EXEMPT_ROUTES`（reason: 'has-own-auth'）のため
 * `X-Service-Auth-Token` ではなく独自の `X-Push-Dispatch-Token` ヘッダーで認可する
 * （`buildMockHonoEnv` が既定で `PUSH_DISPATCH_TOKEN` を含むため `requestApi` ヘルパーが使える）。
 *
 * ## シナリオテーブル
 *
 * | #                 | 事前状態                  | リクエスト条件                        | 期待                              |
 * |--------------------|-----------------------------|------------------------------------------|-------------------------------------|
 * | PUSH-DISPATCH-1    | 発火予約なし               | 正当なdispatchトークン                   | 200・attempted=0（配線到達を確認） |
 * | PUSH-DISPATCH-2    | 発火予約なし               | 不正なdispatchトークン                   | 401                                 |
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
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';
import { container } from 'tsyringe';

import { useInMemoryDB } from '../../../../../tests/shared/env';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';
import { MOCK_PUSH_DISPATCH_TOKEN } from '../../common/mockHonoEnv';
import { requestApi } from '../../common/requestApi';
import { setupGlobalMocks } from '../../common/setupGlobalMocks';

const DISPATCH_TOKEN_HEADER = 'X-Push-Dispatch-Token';

describe('コンポーネントテスト: Push Dispatch Router → Controller → Usecase → Repository → InMemory D1', () => {
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

    it('PUSH-DISPATCH-1: 正当なdispatchトークン_200で配線に到達すること', async () => {
        // Act
        const response = await requestApi(d1, '/push/dispatch', {
            method: 'POST',
            headers: { [DISPATCH_TOKEN_HEADER]: MOCK_PUSH_DISPATCH_TOKEN },
        });
        const body = (await response.json()) as { attempted: number };

        // Assert
        expect(response.status).toBe(200);
        expect(body.attempted).toBe(0);
        const rows = await db.select().from(schema.pushNotificationRequest);
        expect(rows).toHaveLength(0);
    });

    it('PUSH-DISPATCH-2: 不正なdispatchトークン_401を返すこと', async () => {
        // Act
        const response = await requestApi(d1, '/push/dispatch', {
            method: 'POST',
            headers: { [DISPATCH_TOKEN_HEADER]: 'wrong-token' },
        });

        // Assert
        expect(response.status).toBe(401);
    });
});
