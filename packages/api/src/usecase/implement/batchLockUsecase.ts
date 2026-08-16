import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IBatchLockRepository } from '../../repository/interface/IBatchLockRepository';
import type {
    BatchLockAcquireResult,
    IBatchLockUsecase,
} from '../interface/IBatchLockUsecase';

/**
 * ロック保持者が応答不能になった場合に放棄済みとみなすまでの猶予（30分）。
 * 実行時間の実測は約169秒/回（docs/tasks/cicd-73-batch-cron-migration.md §2-2）のため、
 * リトライ・バックオフを含めても十分な安全マージンを確保している。
 */
const STALE_LOCK_MS = 30 * 60 * 1000;

@LogAllMethods
@injectable()
export class BatchLockUsecase implements IBatchLockUsecase {
    public constructor(
        @inject(DI_TOKENS.BatchLockRepository)
        private readonly repository: IBatchLockRepository,
    ) {}

    public async acquire(instanceId: string): Promise<BatchLockAcquireResult> {
        const now = new Date();
        const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
        const acquired = await this.repository.acquire(
            instanceId,
            now.toISOString(),
            staleBefore.toISOString(),
        );
        return { acquired };
    }

    public async release(instanceId: string): Promise<void> {
        await this.repository.release(instanceId);
    }
}
