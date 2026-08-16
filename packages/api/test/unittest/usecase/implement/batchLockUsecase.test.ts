/**
 * batchLockUsecase.test.ts - BatchLockUsecase ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * ### メソッド: acquire()
 * | # | repository.acquireの返り値 | 期待値 |
 * |---|---------------------------|--------|
 * | 1 | true | `{ acquired: true }`を返し、repository.acquireがinstanceId・nowIso・staleBeforeIso（nowIsoの30分前）で呼ばれる |
 * | 2 | false | `{ acquired: false }`を返す |
 *
 * ### メソッド: release()
 * | # | 条件 | 期待値 |
 * |---|------|--------|
 * | 3 | instanceId | repository.releaseがそのままinstanceIdで呼ばれる |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */
import 'reflect-metadata';

import { describe, expect, it } from 'bun:test';

import type { IBatchLockRepository } from '../../../../src/repository/interface/IBatchLockRepository';
import { BatchLockUsecase } from '../../../../src/usecase/implement/batchLockUsecase';

interface MockBatchLockRepository extends IBatchLockRepository {
    acquireCalls: {
        instanceId: string;
        nowIso: string;
        staleBeforeIso: string;
    }[];
    releaseCalls: string[];
}

const createMockRepository = (
    acquireResult: boolean,
): MockBatchLockRepository => ({
    acquireCalls: [],
    releaseCalls: [],
    async acquire(instanceId, nowIso, staleBeforeIso) {
        this.acquireCalls.push({ instanceId, nowIso, staleBeforeIso });
        return acquireResult;
    },
    async release(instanceId) {
        this.releaseCalls.push(instanceId);
    },
});

describe('BatchLockUsecase', () => {
    describe('acquire', () => {
        // 1: repository.acquireがtrueを返す場合
        it('1: 取得できた場合はacquired:trueを返し、staleBeforeIsoはnowIsoの30分前になる', async () => {
            const repository = createMockRepository(true);
            const usecase = new BatchLockUsecase(repository);

            const result = await usecase.acquire('instance-1');

            expect(result).toEqual({ acquired: true });
            expect(repository.acquireCalls).toHaveLength(1);
            const call = repository.acquireCalls[0];
            expect(call?.instanceId).toBe('instance-1');
            const nowMs = new Date(call?.nowIso ?? '').getTime();
            const staleBeforeMs = new Date(
                call?.staleBeforeIso ?? '',
            ).getTime();
            expect(nowMs - staleBeforeMs).toBe(30 * 60 * 1000);
        });

        // 2: repository.acquireがfalseを返す場合
        it('2: 取得できなかった場合はacquired:falseを返す', async () => {
            const repository = createMockRepository(false);
            const usecase = new BatchLockUsecase(repository);

            const result = await usecase.acquire('instance-1');

            expect(result).toEqual({ acquired: false });
        });
    });

    describe('release', () => {
        // 3: repository.releaseがそのままinstanceIdで呼ばれる
        it('3: repository.releaseがinstanceIdそのままで呼ばれる', async () => {
            const repository = createMockRepository(true);
            const usecase = new BatchLockUsecase(repository);

            await usecase.release('instance-1');

            expect(repository.releaseCalls).toEqual(['instance-1']);
        });
    });
});
