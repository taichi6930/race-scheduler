import {
    badRequest,
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
    RaceType,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IRaceDetailLayoutUsecase } from '../usecase/interface/IRaceDetailLayoutUsecase';
import { isProductionAdmin } from '../utility/isProductionAdmin';
import {
    RaceDetailLayoutPreviewRequestSchema,
    RaceDetailLayoutSaveRequestSchema,
} from './raceDetailLayoutController.schemas';
import { renderRaceDetailLayoutPage } from './raceDetailLayoutPage';

/** プレビュー候補として一覧表示するレースの範囲（今日から何日先まで）。 */
const PREVIEW_CANDIDATE_WINDOW_DAYS = 14;

/**
 * Controller層：レース詳細レイアウト編集キット画面（`GET /race-detail-layout`）・
 * 管理API（`GET`/`POST /race-detail-layout/api`、`POST /race-detail-layout/api/preview`）。
 * このWorkerのホスト名自体がCloudflare Accessで保護されている前提のため、
 * このWorker自身は追加の認証を行わない（admin-package-design.md）。
 *
 * 「一旦競輪だけで考える」（race-detail-sdui-design.md §0）というスコープ決定により、
 * raceTypeはKEIRIN固定とする。他競技を編集対象にする場合はraceType選択UIとともに
 * 拡張する。
 */
@LogAllMethods
@injectable()
export class RaceDetailLayoutController {
    public constructor(
        @inject(DI_TOKENS.UiLayoutUsecase)
        private readonly usecase: IRaceDetailLayoutUsecase,
    ) {}

    /**
     * レース詳細レイアウト編集キット画面のHTMLシェルを返す。
     * @returns 静的なHTMLレスポンス（データは含まない）
     */
    public page(): Response {
        return new Response(renderRaceDetailLayoutPage(isProductionAdmin()), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
    }

    /**
     * 現在の構成（保存済み、無ければ既定値）を返す。
     * @returns `{raceType, config}`
     */
    public async get(): Promise<Response> {
        try {
            const config = await this.usecase.getConfig(RaceType.KEIRIN);
            return json({ raceType: RaceType.KEIRIN, config });
        } catch (error) {
            return handleControllerError(
                error,
                'RaceDetailLayoutController.get',
            );
        }
    }

    /**
     * 構成を保存する。
     * @param request - ボディ `{config}` を読み取るための生リクエスト
     * @returns 保存後の構成、検証失敗時は400
     */
    public async save(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                RaceDetailLayoutSaveRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const config = await this.usecase.saveConfig(
                RaceType.KEIRIN,
                parsedBody.value.config,
            );
            return json({ raceType: RaceType.KEIRIN, config });
        } catch (error) {
            return handleControllerError(
                error,
                'RaceDetailLayoutController.save',
            );
        }
    }

    /**
     * 保存せずに、指定した構成を指定レースへ適用した解決結果を返す。
     * @param request - ボディ `{config, raceId}` を読み取るための生リクエスト
     * @returns 解決済みのUIスキーマ。該当レースが無ければ404、検証失敗時は400
     */
    public async preview(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                RaceDetailLayoutPreviewRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const preview = await this.usecase.previewConfig(
                parsedBody.value.config,
                parsedBody.value.raceId,
            );
            if (!preview) {
                return badRequest('指定されたレースが見つかりません', 404);
            }
            return json(preview);
        } catch (error) {
            return handleControllerError(
                error,
                'RaceDetailLayoutController.preview',
            );
        }
    }

    /**
     * プレビュー候補として、今日から{@link PREVIEW_CANDIDATE_WINDOW_DAYS}日以内に
     * 開催されるKEIRINレースの一覧を返す。
     * @returns `{races}`
     */
    public async races(): Promise<Response> {
        try {
            const races = await this.usecase.listPreviewCandidates(
                PREVIEW_CANDIDATE_WINDOW_DAYS,
            );
            return json({ races });
        } catch (error) {
            return handleControllerError(
                error,
                'RaceDetailLayoutController.races',
            );
        }
    }
}
