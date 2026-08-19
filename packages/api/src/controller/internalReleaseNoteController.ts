import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IReleaseNoteUsecase } from '../usecase/interface/IReleaseNoteUsecase';

/**
 * Controller層：更新履歴の運用者専用API（`GET /internal/release-notes`）。
 * `packages/admin`（Cloudflare Accessで保護された管理専用Worker）からのみ
 * `X-Service-Auth-Token`（`router.ts` の `requireServiceAuth`）経由で呼ばれる想定のため、
 * 公開APIとしては扱わない（`SERVICE_AUTH_EXEMPT_ROUTES` に免除エントリを追加しないこと）。
 * 分割元の非公開リポジトリ（race-schedule）分も含む全件を返す点が、
 * front向けの公開エンドポイント（`GET /release-notes`）との違い。
 */
@LogAllMethods
@injectable()
export class InternalReleaseNoteController {
    public constructor(
        @inject(DI_TOKENS.ReleaseNoteUsecase)
        private readonly usecase: IReleaseNoteUsecase,
    ) {}

    /**
     * リポジトリを問わず全リリースノートを公開日時の新しい順で返す。
     * @returns リリースノート配列を含むレスポンス
     */
    public async list(): Promise<Response> {
        try {
            const releaseNotes = await this.usecase.listAll();
            return json(releaseNotes, 200);
        } catch (error) {
            return handleControllerError(
                error,
                'InternalReleaseNoteController.list',
            );
        }
    }
}
