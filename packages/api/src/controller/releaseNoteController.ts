import {
    badRequest,
    DI_TOKENS,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
    releaseNoteWriteSchema,
    ValidationError,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IReleaseNoteUsecase } from '../usecase/interface/IReleaseNoteUsecase';

/**
 * 更新履歴コントローラー（`GET /release-notes` / `POST /release-notes`）。
 * frontはGETのレスポンスをGitHub Releases APIと同じ形として解釈する
 * （release_remote_data_source.dart参照）。
 * POSTは`scripts/release/autoRelease.ts`からの`X-Service-Auth-Token`経由の
 * サービス間書き込み専用のため、`SERVICE_AUTH_EXEMPT_ROUTES`には免除エントリを追加しない。
 */
@LogAllMethods
@injectable()
export class ReleaseNoteController {
    public constructor(
        @inject(DI_TOKENS.ReleaseNoteUsecase)
        private readonly usecase: IReleaseNoteUsecase,
    ) {}

    /**
     * 公開リポジトリ（race-scheduler）由来のリリースノートを公開日時の新しい順で返す。
     * 分割元の非公開リポジトリ（race-schedule）分は含まない（`packages/admin` の
     * `GET /internal/release-notes` 経由でのみ参照できる）。
     * @returns リリースノート配列を含むレスポンス
     */
    public async get(): Promise<Response> {
        try {
            const releaseNotes = await this.usecase.listPublic();
            return json(releaseNotes, 200);
        } catch (error) {
            return handleControllerError(error, 'ReleaseNoteController.get');
        }
    }

    /**
     * リリースノート1件をupsertする。(tag_name, source_repo) が一致する既存行が
     * あれば更新、無ければ新規作成する。
     * @param request - ボディ（{@link releaseNoteWriteSchema}）を読み取るための生リクエスト
     * @returns 成功時201、検証失敗時400
     */
    public async create(request: Request): Promise<Response> {
        try {
            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                releaseNoteWriteSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            await this.usecase.upsert(parsedBody.value);
            return json({ ok: true }, 201);
        } catch (error) {
            if (error instanceof ValidationError) {
                return badRequest(error.message, error.status);
            }
            return handleControllerError(error, 'ReleaseNoteController.create');
        }
    }
}
