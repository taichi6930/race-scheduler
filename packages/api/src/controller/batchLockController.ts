import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

import type { IBatchLockUsecase } from '../usecase/interface/IBatchLockUsecase';

const BatchLockRequestSchema = z.object({
    instanceId: z.string().min(1),
});

/**
 * Controller層：batch実行の排他制御ロック（CICD-73/CONC-03）専用エンドポイント。
 * batch Worker（`packages/batch`）のみが `X-Service-Auth-Token` 経由で呼び出す
 * 想定のため、公開APIとしては扱わない（router.ts の `requireServiceAuth` で保護）。
 */
@LogAllMethods
@injectable()
export class BatchLockController {
    public constructor(
        @inject(DI_TOKENS.BatchLockUsecase)
        private readonly usecase: IBatchLockUsecase,
    ) {}

    /**
     * ロックの取得を試みる。既に他のインスタンスが保持中（かつstaleでない）の場合は
     * 409を返す。
     * body: { instanceId: string }
     * @param request
     */
    public async acquire(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                BatchLockRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const result = await this.usecase.acquire(
                parsedBody.value.instanceId,
            );
            if (!result.acquired) {
                return json(
                    {
                        error: 'Conflict',
                        message: '他のbatch実行が進行中です',
                    },
                    409,
                );
            }
            return json({ acquired: true }, 200);
        } catch (error) {
            return handleControllerError(error, 'BatchLockController.acquire');
        }
    }

    /**
     * ロックを解放する。instanceIdが現在の保持者と一致しない場合は何もしない
     * （冪等）。
     * body: { instanceId: string }
     * @param request
     */
    public async release(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                BatchLockRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            await this.usecase.release(parsedBody.value.instanceId);
            return json({ success: true }, 200);
        } catch (error) {
            return handleControllerError(error, 'BatchLockController.release');
        }
    }
}
