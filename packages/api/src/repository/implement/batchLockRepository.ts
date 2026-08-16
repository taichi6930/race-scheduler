import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import { batchRunLock } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type { IBatchLockRepository } from '../interface/IBatchLockRepository';

const LOCK_ROW_ID = 1;

@LogAllMethods
@injectable()
export class BatchLockRepository implements IBatchLockRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    public async acquire(
        instanceId: string,
        nowIso: string,
        staleBeforeIso: string,
    ): Promise<boolean> {
        const rows = await this.drizzleGateway.db
            .update(batchRunLock)
            .set({
                workflowInstanceId: instanceId,
                startedAt: nowIso,
            })
            .where(
                and(
                    eq(batchRunLock.id, LOCK_ROW_ID),
                    or(
                        isNull(batchRunLock.workflowInstanceId),
                        lt(batchRunLock.startedAt, staleBeforeIso),
                        // 同一instanceIdによる再取得は成功として扱う（冪等）。
                        // router.tsが事前取得した後、同じinstanceIdでWorkflow自身が
                        // 再確認のため取得を試みるケース（Cloudflareのネイティブcron
                        // トリガーはrouter.tsを経由せずWorkflowを直接起動するため、
                        // Workflow側でも取得を試みる必要がある。CICD-73/CONC-03）で、
                        // 「既に自分が保持している」を取得失敗と誤判定しないようにする。
                        eq(batchRunLock.workflowInstanceId, instanceId),
                    ),
                ),
            )
            .returning({ id: batchRunLock.id });
        return rows.length > 0;
    }

    public async release(instanceId: string): Promise<void> {
        await this.drizzleGateway.db
            .update(batchRunLock)
            .set({
                workflowInstanceId: null,
                startedAt: null,
            })
            .where(
                and(
                    eq(batchRunLock.id, LOCK_ROW_ID),
                    eq(batchRunLock.workflowInstanceId, instanceId),
                ),
            );
    }
}
