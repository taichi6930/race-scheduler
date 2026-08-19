import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IReleaseNotesUsecase } from '../usecase/interface/IReleaseNotesUsecase';
import { isProductionAdmin } from '../utility/isProductionAdmin';
import { renderReleaseNotesPage } from './releaseNotesPage';

/**
 * Controller層：更新履歴の全リポジトリ一覧画面（`GET /release-notes`）・
 * 一覧取得API（`GET /release-notes/api`）。閲覧専用（更新・削除操作は無い）。
 * このWorkerのホスト名自体がCloudflare Accessで保護されている前提のため、
 * このWorker自身は追加の認証を行わない（admin-package-design.md）。
 */
@LogAllMethods
@injectable()
export class ReleaseNotesController {
    public constructor(
        @inject(DI_TOKENS.ReleaseNoteUsecase)
        private readonly usecase: IReleaseNotesUsecase,
    ) {}

    /**
     * 更新履歴一覧画面のHTMLシェルを返す。
     * @returns 静的なHTMLレスポンス（データは含まない）
     */
    public page(): Response {
        return new Response(renderReleaseNotesPage(isProductionAdmin()), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
    }

    /**
     * 全リリースノート（非公開リポジトリ分を含む）を公開日時の新しい順で返す。
     * @returns リリースノート配列を含むレスポンス
     */
    public async list(): Promise<Response> {
        try {
            const notes = await this.usecase.list();
            return json(notes, 200);
        } catch (error) {
            return handleControllerError(error, 'ReleaseNotesController.list');
        }
    }
}
