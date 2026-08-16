import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

import type { IFeatureFlagsUsecase } from '../usecase/interface/IFeatureFlagsUsecase';
import { isProductionAdmin } from '../utility/isProductionAdmin';
import { renderFeatureFlagsPage } from './featureFlagsPage';

/** `POST /flags/api`（機能フラグの更新）リクエストのスキーマ。 */
const FeatureFlagsUpdateRequestSchema = z.object({
    key: z.string().min(1),
    enabled: z.boolean(),
});

/**
 * Controller層：機能フラグ管理画面（`GET /flags`）・管理API
 * （`GET`/`POST /flags/api`）。
 * このWorkerのホスト名自体がCloudflare Accessで保護されている前提のため、
 * このWorker自身は追加の認証を行わない（admin-package-design.md）。
 */
@LogAllMethods
@injectable()
export class FeatureFlagsController {
    public constructor(
        @inject(DI_TOKENS.FeatureFlagUsecase)
        private readonly usecase: IFeatureFlagsUsecase,
    ) {}

    /**
     * 機能フラグ管理画面のHTMLシェルを返す。
     * @returns 静的なHTMLレスポンス（データは含まない）
     */
    public page(): Response {
        return new Response(renderFeatureFlagsPage(isProductionAdmin()), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
    }

    /**
     * 登録済み機能フラグの状態一覧を返す。
     * @returns フラグ一覧
     */
    public async list(): Promise<Response> {
        try {
            const flags = await this.usecase.list();
            return json({ flags }, 200);
        } catch (error) {
            return handleControllerError(error, 'FeatureFlagsController.list');
        }
    }

    /**
     * 指定した機能フラグの値を更新する。
     *
     * production環境ではまだフラグの切り替えをサポートしない（ユーザー依頼、
     * 2026-08-08）。画面側（`featureFlagsPage.ts`）でスイッチを読み取り専用にする
     * のに加え、直接APIを叩かれた場合の多層防御としてここでも拒否する。
     * @param request - ボディ `{key, enabled}` を読み取るための生リクエスト
     * @returns 更新後のフラグ一覧、production環境なら403、検証失敗時は400
     */
    public async update(request: Request): Promise<Response> {
        if (isProductionAdmin()) {
            return json(
                { message: '本番環境ではフラグの切り替えはできません' },
                403,
            );
        }
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                FeatureFlagsUpdateRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const flags = await this.usecase.setFlag(
                parsedBody.value.key,
                parsedBody.value.enabled,
            );
            return json({ flags }, 200);
        } catch (error) {
            return handleControllerError(
                error,
                'FeatureFlagsController.update',
            );
        }
    }
}
