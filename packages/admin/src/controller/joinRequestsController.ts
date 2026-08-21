import {
    handleControllerError,
    json,
    LogAllMethods,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import { ADMIN_DI_TOKENS } from '../di/tokens';
import type { IJoinRequestsUsecase } from '../usecase/interface/IJoinRequestsUsecase';
import { isProductionAdmin } from '../utility/isProductionAdmin';
import { renderJoinRequestsPage } from './joinRequestsPage';

/**
 * Controller層：参加リクエスト一覧画面（`GET /join-requests`）・一覧取得API
 * （`GET /join-requests/api`）・承認/却下API
 * （`POST /join-requests/api/:id/approve`・`POST /join-requests/api/:id/reject`）。
 * このWorkerのホスト名自体がCloudflare Accessで保護されている前提のため、
 * このWorker自身は追加の認証を行わない（admin-package-design.md）。
 */
@LogAllMethods
@injectable()
export class JoinRequestsController {
    public constructor(
        @inject(ADMIN_DI_TOKENS.JoinRequestsUsecase)
        private readonly usecase: IJoinRequestsUsecase,
    ) {}

    /**
     * 参加リクエスト一覧画面のHTMLシェルを返す。
     * @returns 静的なHTMLレスポンス（データは含まない）
     */
    public page(): Response {
        return new Response(renderJoinRequestsPage(isProductionAdmin()), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
    }

    /**
     * 承認待ちの参加リクエスト一覧を返す。
     * @returns 参加リクエスト一覧
     */
    public async list(): Promise<Response> {
        try {
            const requests = await this.usecase.list();
            return json({ requests }, 200);
        } catch (error) {
            return handleControllerError(error, 'JoinRequestsController.list');
        }
    }

    /**
     * 参加リクエストを承認する。
     * @param id - 承認対象のリクエストID
     * @returns 成功時は200、対象が無い/pendingでなければメインAPI由来のエラーが伝播する
     */
    public async approve(id: string): Promise<Response> {
        try {
            await this.usecase.approve(id);
            return json({ ok: true }, 200);
        } catch (error) {
            return handleControllerError(
                error,
                'JoinRequestsController.approve',
            );
        }
    }

    /**
     * 参加リクエストを却下する。
     * @param id - 却下対象のリクエストID
     * @returns 成功時は200、対象が無い/pendingでなければメインAPI由来のエラーが伝播する
     */
    public async reject(id: string): Promise<Response> {
        try {
            await this.usecase.reject(id);
            return json({ ok: true }, 200);
        } catch (error) {
            return handleControllerError(
                error,
                'JoinRequestsController.reject',
            );
        }
    }
}
