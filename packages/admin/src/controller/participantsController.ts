import {
    handleControllerError,
    json,
    LogAllMethods,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import { ADMIN_DI_TOKENS } from '../di/tokens';
import type { IParticipantsUsecase } from '../usecase/interface/IParticipantsUsecase';
import { isProductionAdmin } from '../utility/isProductionAdmin';
import { renderParticipantsPage } from './participantsPage';

/**
 * Controller層：参加者一覧画面（`GET /participants`）・一覧取得API
 * （`GET /participants/api`）。閲覧専用（更新・削除操作は無い）。
 * このWorkerのホスト名自体がCloudflare Accessで保護されている前提のため、
 * このWorker自身は追加の認証を行わない（admin-package-design.md）。
 */
@LogAllMethods
@injectable()
export class ParticipantsController {
    public constructor(
        @inject(ADMIN_DI_TOKENS.ParticipantsUsecase)
        private readonly usecase: IParticipantsUsecase,
    ) {}

    /**
     * 参加者一覧画面のHTMLシェルを返す。
     * @returns 静的なHTMLレスポンス（データは含まない）
     */
    public page(): Response {
        return new Response(renderParticipantsPage(isProductionAdmin()), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
    }

    /**
     * 招待から登録済みの参加者一覧を返す。
     * @returns 参加者一覧
     */
    public async list(): Promise<Response> {
        try {
            const participants = await this.usecase.list();
            return json({ participants }, 200);
        } catch (error) {
            return handleControllerError(error, 'ParticipantsController.list');
        }
    }
}
