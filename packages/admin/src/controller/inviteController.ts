import {
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

import { ADMIN_DI_TOKENS } from '../di/tokens';
import type { IInviteUsecase } from '../usecase/interface/IInviteUsecase';
import { buildInviteUrl } from '../utility/frontConfig';
import { isProductionAdmin } from '../utility/isProductionAdmin';
import { renderInvitePage } from './invitePage';

/**
 * メインAPI（`InviteIssueRequestSchema`、`packages/api/src/controller/authController.schemas.ts`）
 * と同じ上限。パッケージ境界を越えて定数を共有しないため個別に定義している
 * （最終的な検証はメインAPI側で行う。ここでの検証はUXのための構造チェック）。
 */
const MEMO_MAX_LENGTH = 200;

/** `POST /invite/api`（招待発行）リクエストのスキーマ。 */
const InviteIssueRequestSchema = z.object({
    memo: z.string().max(MEMO_MAX_LENGTH).nullable().optional(),
});

/**
 * Controller層：招待発行画面（`GET /invite`）・発行API（`POST /invite/api`）。
 * このWorkerのホスト名自体がCloudflare Accessで保護されている前提のため、
 * このWorker自身は追加の認証を行わない（admin-package-design.md）。
 */
@LogAllMethods
@injectable()
export class InviteController {
    public constructor(
        @inject(ADMIN_DI_TOKENS.InviteUsecase)
        private readonly usecase: IInviteUsecase,
    ) {}

    /**
     * 招待発行画面のHTMLシェルを返す。
     * @returns 静的なHTMLレスポンス（データは含まない）
     */
    public page(): Response {
        return new Response(renderInvitePage(isProductionAdmin()), {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
    }

    /**
     * 招待を新規発行する。
     * @param request - ボディ `{memo}` を読み取るための生リクエスト
     * @returns 発行された招待トークンとURL、検証失敗時は400
     */
    public async issue(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                InviteIssueRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const result = await this.usecase.issueInvite(
                parsedBody.value.memo ?? null,
            );
            return json(
                {
                    token: result.token,
                    inviteUrl: buildInviteUrl(result.token),
                },
                201,
            );
        } catch (error) {
            return handleControllerError(error, 'InviteController.issue');
        }
    }
}
