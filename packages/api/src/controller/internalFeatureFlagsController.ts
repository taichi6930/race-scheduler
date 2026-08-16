import {
    badRequest,
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
    ValidationError,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IFeatureFlagUsecase } from '../usecase/interface/IFeatureFlagUsecase';
import { FeatureFlagsUpdateRequestSchema } from './internalFeatureFlagsController.schemas';

/**
 * Controller層：機能フラグ管理のサービス間API（`GET`/`POST /internal/feature-flags`）。
 * `packages/admin`（Cloudflare Accessで保護された管理専用Worker）からのみ
 * `X-Service-Auth-Token`（`router.ts` の `requireServiceAuth`）経由で呼ばれる想定のため、
 * 公開APIとしては扱わない（`SERVICE_AUTH_EXEMPT_ROUTES` に免除エントリを追加しないこと）。
 */
@LogAllMethods
@injectable()
export class InternalFeatureFlagsController {
    public constructor(
        @inject(DI_TOKENS.FeatureFlagUsecase)
        private readonly usecase: IFeatureFlagUsecase,
    ) {}

    /**
     * 登録済み機能フラグの状態一覧を返す。
     * @returns フラグ一覧
     */
    public async list(): Promise<Response> {
        try {
            const flags = await this.usecase.list();
            return json({ flags }, 200);
        } catch (error) {
            return handleControllerError(
                error,
                'InternalFeatureFlagsController.list',
            );
        }
    }

    /**
     * 指定した機能フラグの値を更新する。
     * @param request - ボディ `{key, enabled}` を読み取るための生リクエスト
     * @returns 更新後のフラグ一覧、または検証失敗時は400
     */
    public async update(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                FeatureFlagsUpdateRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            await this.usecase.setFlag(
                parsedBody.value.key,
                parsedBody.value.enabled,
            );
            const flags = await this.usecase.list();
            return json({ flags }, 200);
        } catch (error) {
            if (error instanceof ValidationError) {
                return badRequest(error.message, error.status);
            }
            return handleControllerError(
                error,
                'InternalFeatureFlagsController.update',
            );
        }
    }
}
