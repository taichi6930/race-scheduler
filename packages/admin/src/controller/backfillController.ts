import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

import type {
    BackfillPlaceResult,
    BackfillRaceResult,
} from '../dto/backfillResult';
import type { IBackfillUsecase } from '../usecase/interface/IBackfillUsecase';
import { isProductionAdmin } from '../utility/isProductionAdmin';
import { renderBackfillPage } from './backfillPage';

/**
 * `POST /backfill/api/{place,race}`共通のリクエストボディスキーマ。
 * 日付範囲・レース種別の妥当性（400日以内等）はメインAPI
 * （`packages/api`の`BackfillRequestBodySchema`）が最終的に検証するため、
 * ここでは構造の検証のみ行う。
 */
const BackfillRequestSchema = z.object({
    startDate: z.string().min(1),
    finishDate: z.string().min(1),
    raceTypeList: z.array(z.string()).min(1),
});

/**
 * Controller層：バックフィル実行画面（`GET /backfill`）・実行API
 * （`POST /backfill/api/{place,race}`）。
 * このWorkerのホスト名自体がCloudflare Accessで保護されている前提のため、
 * このWorker自身は追加の認証を行わない（admin-package-design.md）。
 * front（`/backfill`画面）から移設したもの（2026-08-08）。
 */
@LogAllMethods
@injectable()
export class BackfillController {
    public constructor(
        @inject(DI_TOKENS.BackfillUsecase)
        private readonly usecase: IBackfillUsecase,
    ) {}

    /**
     * バックフィル実行画面のHTMLシェルを返す。
     * @returns 静的なHTMLレスポンス（データは含まない）
     */
    public page(): Response {
        return new Response(renderBackfillPage(isProductionAdmin()), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
    }

    /**
     * 指定期間・レース種別の開催場情報をキャッシュのみで再同期する。
     * @param request - ボディ `{startDate, finishDate, raceTypeList}` を読み取るための生リクエスト
     * @returns バックフィル結果、検証失敗時は400
     */
    public async place(request: Request): Promise<Response> {
        return this.run(request, (usecase, filter) =>
            usecase.backfillPlace(filter),
        );
    }

    /**
     * 指定期間・レース種別のレース情報をキャッシュのみで再同期する。
     * @param request - ボディ `{startDate, finishDate, raceTypeList}` を読み取るための生リクエスト
     * @returns バックフィル結果、検証失敗時は400
     */
    public async race(request: Request): Promise<Response> {
        return this.run(request, (usecase, filter) =>
            usecase.backfillRace(filter),
        );
    }

    private async run(
        request: Request,
        invoke: (
            usecase: IBackfillUsecase,
            filter: z.infer<typeof BackfillRequestSchema>,
        ) => Promise<BackfillPlaceResult | BackfillRaceResult>,
    ): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                BackfillRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const result = await invoke(this.usecase, parsedBody.value);
            return json(result, 200);
        } catch (error) {
            return handleControllerError(error, 'BackfillController.run');
        }
    }
}
