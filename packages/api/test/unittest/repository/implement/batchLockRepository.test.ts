/**
 * batchLockRepository.test.ts - BatchLockRepository ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: acquire()
 * | ケース | ロック状態 | staleBeforeとの関係 | 期待値 |
 * |--------|-----------|---------------------|--------|
 * | A1 | 空き（workflowInstanceId=null） | - | true・行が更新される |
 * | A2 | 他インスタンスが保持中 | startedAt >= staleBefore（新しい） | false・行は変化しない |
 * | A3 | 他インスタンスが保持中 | startedAt < staleBefore（放棄済み） | true・行が上書きされる |
 * | A4 | 同一instanceIdが既に保持中 | startedAt >= staleBefore（新しい） | true・startedAtが更新される（冪等な再取得） |
 *
 * ### メソッド: release()
 * | ケース | ロック状態 | 期待値 |
 * |--------|-----------|--------|
 * | R1 | 指定instanceIdが保持中 | null/nullにリセットされる |
 * | R2 | 別instanceIdが保持中（既に奪われている） | 何もしない（対象行は変化しない） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import { beforeEach, describe, expect, it } from 'bun:test';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import 'reflect-metadata';

import * as schema from '../../../../src/db/schema';
import type { IDrizzleGateway } from '../../../../src/gateway/interface/IDrizzleGateway';
import { BatchLockRepository } from '../../../../src/repository/implement/batchLockRepository';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

describe('BatchLockRepository', () => {
    let repository: BatchLockRepository;
    let db: DrizzleD1Database<typeof schema>;

    beforeEach(() => {
        db = drizzle(createInMemoryD1Database(), { schema });
        const drizzleGateway: IDrizzleGateway = { db };
        repository = new BatchLockRepository(drizzleGateway);
    });

    describe('acquire', () => {
        // A1: 空き → true・行が更新される
        it('A1: ロックが空きの場合は取得でき行が更新される', async () => {
            const result = await repository.acquire(
                'instance-1',
                '2026-08-03T00:00:00.000Z',
                '2026-08-02T23:30:00.000Z',
            );

            expect(result).toBe(true);
            const rows = await db.select().from(schema.batchRunLock);
            expect(rows[0]).toMatchObject({
                workflowInstanceId: 'instance-1',
                startedAt: '2026-08-03T00:00:00.000Z',
            });
        });

        // A2: 他インスタンスが保持中・新しい → false・行は変化しない
        it('A2: 他インスタンスが保持中かつstaleでない場合は取得できない', async () => {
            await repository.acquire(
                'instance-1',
                '2026-08-03T00:00:00.000Z',
                '2026-08-02T23:30:00.000Z',
            );

            const result = await repository.acquire(
                'instance-2',
                '2026-08-03T00:05:00.000Z',
                '2026-08-02T23:35:00.000Z',
            );

            expect(result).toBe(false);
            const rows = await db.select().from(schema.batchRunLock);
            expect(rows[0]).toMatchObject({
                workflowInstanceId: 'instance-1',
                startedAt: '2026-08-03T00:00:00.000Z',
            });
        });

        // A3: 他インスタンスが保持中・放棄済み（stale） → true・行が上書きされる
        it('A3: 他インスタンスが保持中でもstaleな場合は取得できる', async () => {
            await repository.acquire(
                'instance-1',
                '2026-08-03T00:00:00.000Z',
                '2026-08-02T23:30:00.000Z',
            );

            // staleBeforeがinstance-1のstartedAtより後 → instance-1は放棄済み扱い
            const result = await repository.acquire(
                'instance-2',
                '2026-08-03T01:00:00.000Z',
                '2026-08-03T00:30:00.000Z',
            );

            expect(result).toBe(true);
            const rows = await db.select().from(schema.batchRunLock);
            expect(rows[0]).toMatchObject({
                workflowInstanceId: 'instance-2',
                startedAt: '2026-08-03T01:00:00.000Z',
            });
        });

        // A4: 同一instanceIdが既に保持中・stale判定に関わらず → true・startedAtが更新される
        it('A4: 同一instanceIdによる再取得は冪等に成功しstartedAtが更新される', async () => {
            await repository.acquire(
                'instance-1',
                '2026-08-03T00:00:00.000Z',
                '2026-08-02T23:30:00.000Z',
            );

            // staleBeforeはinstance-1のstartedAtより前（=staleではない）だが、
            // 同一instanceIdによる再取得のため成功するはず
            const result = await repository.acquire(
                'instance-1',
                '2026-08-03T00:10:00.000Z',
                '2026-08-02T23:40:00.000Z',
            );

            expect(result).toBe(true);
            const rows = await db.select().from(schema.batchRunLock);
            expect(rows[0]).toMatchObject({
                workflowInstanceId: 'instance-1',
                startedAt: '2026-08-03T00:10:00.000Z',
            });
        });
    });

    describe('release', () => {
        // R1: 指定instanceIdが保持中 → null/nullにリセットされる
        it('R1: 保持者と一致する場合はnull/nullにリセットされる', async () => {
            await repository.acquire(
                'instance-1',
                '2026-08-03T00:00:00.000Z',
                '2026-08-02T23:30:00.000Z',
            );

            await repository.release('instance-1');

            const rows = await db.select().from(schema.batchRunLock);
            expect(rows[0]).toMatchObject({
                workflowInstanceId: null,
                startedAt: null,
            });
        });

        // R2: 別instanceIdが保持中 → 何もしない
        it('R2: 保持者と一致しない場合は対象行が変化しない', async () => {
            await repository.acquire(
                'instance-1',
                '2026-08-03T00:00:00.000Z',
                '2026-08-02T23:30:00.000Z',
            );

            await repository.release('instance-2');

            const rows = await db.select().from(schema.batchRunLock);
            expect(rows[0]).toMatchObject({
                workflowInstanceId: 'instance-1',
                startedAt: '2026-08-03T00:00:00.000Z',
            });
        });
    });
});
