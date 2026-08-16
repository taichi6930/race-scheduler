import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IBackfillUsecase } from '../usecase/interface/IBackfillUsecase';
import { BackfillRequestBodySchema } from './backfillController.schemas';

/**
 * Controller層：バックフィル（R2キャッシュのみでの再同期）機能のHTTP入出力を担う。
 * `packages/admin`（Cloudflare Accessで保護された管理専用Worker）からのみ
 * `X-Service-Auth-Token`経由で呼ばれる想定のため、公開APIとしては扱わない
 * （`SERVICE_AUTH_EXEMPT_ROUTES`に免除エントリを追加しないこと）。
 * 生スクレイピングは一切行わないため（`cacheOnly: true`固定）、外部サイトへの
 * 意図しないアクセスは発生しない。
 */
@LogAllMethods
@injectable()
export class BackfillController {
    public constructor(
        @inject(DI_TOKENS.BackfillUsecase)
        private readonly usecase: IBackfillUsecase,
    ) {}

    /**
     * POST /internal/backfill/place
     * body: { startDate, finishDate, raceTypeList }
     * @param request HTTPリクエスト
     * @returns バックフィル結果を含むレスポンス
     */
    public async place(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsed = parseBodyOrBadRequest(
                BackfillRequestBodySchema,
                body,
            );
            if (!parsed.ok) return parsed.response;

            const result = await this.usecase.backfillPlace(parsed.value);
            return json(result);
        } catch (error) {
            return handleControllerError(error, 'BackfillController.place');
        }
    }

    /**
     * POST /internal/backfill/race
     * body: { startDate, finishDate, raceTypeList }
     * @param request HTTPリクエスト
     * @returns バックフィル結果を含むレスポンス
     */
    public async race(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsed = parseBodyOrBadRequest(
                BackfillRequestBodySchema,
                body,
            );
            if (!parsed.ok) return parsed.response;

            const result = await this.usecase.backfillRace(parsed.value);
            return json(result);
        } catch (error) {
            return handleControllerError(error, 'BackfillController.race');
        }
    }
}
