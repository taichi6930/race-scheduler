import {
    badRequest,
    DI_TOKENS,
    getCurrentUserId,
    handleControllerError,
    json,
    LogAllMethods,
    parseBodyOrBadRequest,
    resolveRaceIdOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IFavoriteUsecase } from '../usecase/interface/IFavoriteUsecase';
import {
    FavoriteAddRequestSchema,
    FavoriteRemoveRequestSchema,
} from './favoriteController.schemas';

/**
 * Controller層：お気に入りレース（user単位、段階2）。
 * すべてセッション認証必須のため、`getCurrentUserId()` は常に非nullのはずだが、
 * ミドルウェアの取りこぼしに備えフェイルクローズで401を返す（多層防御）。
 */
@LogAllMethods
@injectable()
export class FavoriteController {
    public constructor(
        @inject(DI_TOKENS.FavoriteUsecase)
        private readonly usecase: IFavoriteUsecase,
    ) {}

    public async fetch(): Promise<Response> {
        try {
            const userId = getCurrentUserId();
            if (!userId) return badRequest('Unauthorized', 401);
            const raceIds = await this.usecase.fetch(userId);
            return json({ raceIds });
        } catch (error) {
            return handleControllerError(error, 'FavoriteController.fetch');
        }
    }

    public async add(request: Request): Promise<Response> {
        try {
            const userId = getCurrentUserId();
            if (!userId) return badRequest('Unauthorized', 401);

            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                FavoriteAddRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const parsedRaceId = resolveRaceIdOrBadRequest(
                parsedBody.value.raceId,
            );
            if (!parsedRaceId.ok) return parsedRaceId.response;

            await this.usecase.add(userId, parsedRaceId.value);
            return json({ ok: true });
        } catch (error) {
            return handleControllerError(error, 'FavoriteController.add');
        }
    }

    public async remove(request: Request): Promise<Response> {
        try {
            const userId = getCurrentUserId();
            if (!userId) return badRequest('Unauthorized', 401);

            const body: unknown = await request.json();
            const parsedBody = parseBodyOrBadRequest(
                FavoriteRemoveRequestSchema,
                body,
            );
            if (!parsedBody.ok) return parsedBody.response;

            const parsedRaceId = resolveRaceIdOrBadRequest(
                parsedBody.value.raceId,
            );
            if (!parsedRaceId.ok) return parsedRaceId.response;

            await this.usecase.remove(userId, parsedRaceId.value);
            return json({ ok: true });
        } catch (error) {
            return handleControllerError(error, 'FavoriteController.remove');
        }
    }
}
