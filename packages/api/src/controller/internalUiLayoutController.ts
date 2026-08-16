import {
    badRequest,
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
    RaceTypeSchema,
    resolveRaceIdOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IUiLayoutUsecase } from '../usecase/interface/IUiLayoutUsecase';
import {
    UiLayoutPreviewRequestSchema,
    UiLayoutSaveRequestSchema,
} from './internalUiLayoutController.schemas';

/**
 * Controller層：レイアウト構成管理のサービス間API
 * （`GET`/`POST /internal/ui-layout`、`POST /internal/ui-layout/preview`）。
 * `packages/admin`（Cloudflare Accessで保護された管理専用Worker）からのみ
 * `X-Service-Auth-Token`（`router.ts` の `requireServiceAuth`）経由で呼ばれる想定のため、
 * 公開APIとしては扱わない（`SERVICE_AUTH_EXEMPT_ROUTES` に免除エントリを追加しないこと）。
 */
@LogAllMethods
@injectable()
export class InternalUiLayoutController {
    public constructor(
        @inject(DI_TOKENS.UiLayoutUsecase)
        private readonly usecase: IUiLayoutUsecase,
    ) {}

    /**
     * 指定raceTypeの構成（D1保存済み、無ければ既定構成）を返す。
     * @param searchParams URLSearchParams（raceType）
     * @returns `{raceType, config}`。raceType未指定・不正な場合は400
     */
    public async get(searchParams: URLSearchParams): Promise<Response> {
        try {
            const parsedRaceType = RaceTypeSchema.safeParse(
                searchParams.get('raceType'),
            );
            if (!parsedRaceType.success) {
                return badRequest('raceTypeが不正です', 400);
            }
            const config = await this.usecase.getConfig(parsedRaceType.data);
            return json({ raceType: parsedRaceType.data, config });
        } catch (error) {
            return handleControllerError(
                error,
                'InternalUiLayoutController.get',
            );
        }
    }

    /**
     * 指定raceTypeの構成をD1へ保存する。
     * @param request HTTPリクエスト（body: `{raceType, config}`）
     * @returns 保存した構成。検証失敗時は400
     */
    public async save(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                UiLayoutSaveRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            await this.usecase.saveConfig(
                parsedBody.value.raceType,
                parsedBody.value.config,
            );
            return json({
                raceType: parsedBody.value.raceType,
                config: parsedBody.value.config,
            });
        } catch (error) {
            return handleControllerError(
                error,
                'InternalUiLayoutController.save',
            );
        }
    }

    /**
     * 保存せずに、指定した構成を指定レースへ適用した解決結果を返す
     * （管理画面のプレビュー用）。
     * @param request HTTPリクエスト（body: `{config, raceId}`）
     * @returns 解決済みのUIスキーマ。該当レースが無ければ404、検証失敗時は400
     */
    public async preview(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                UiLayoutPreviewRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const parsedRaceId = resolveRaceIdOrBadRequest(
                parsedBody.value.raceId,
            );
            if (!parsedRaceId.ok) return parsedRaceId.response;

            const preview = await this.usecase.previewConfig(
                parsedBody.value.config,
                parsedRaceId.value,
            );
            if (!preview) {
                return badRequest('指定されたレースが見つかりません', 404);
            }
            return json(preview);
        } catch (error) {
            return handleControllerError(
                error,
                'InternalUiLayoutController.preview',
            );
        }
    }
}
