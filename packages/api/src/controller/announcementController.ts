import {
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IAnnouncementUsecase } from '../usecase/interface/IAnnouncementUsecase';

/**
 * Server-Driven UI PoC 用コントローラー（`GET /ui/announcement`）。
 * front はこのレスポンスをそのまま解釈して起動時お知らせバナーを描画する。
 * `enabled` の値は機能フラグ（`FeatureFlagUsecase`、`GET /admin/flags` で環境ごとに
 * 切り替え可能）で決まるため、このコントローラー自体はリクエストの中身を見ない。
 */
@LogAllMethods
@injectable()
export class AnnouncementController {
    public constructor(
        @inject(DI_TOKENS.AnnouncementUsecase)
        private readonly usecase: IAnnouncementUsecase,
    ) {}

    /**
     * 起動時お知らせバナーのUIスキーマを返す。
     * @returns UIスキーマ（`Announcement`）を含むレスポンス
     */
    public async get(): Promise<Response> {
        try {
            const announcement = await this.usecase.getAnnouncement();
            return json(announcement, 200);
        } catch (error) {
            return handleControllerError(error, 'AnnouncementController.get');
        }
    }
}
