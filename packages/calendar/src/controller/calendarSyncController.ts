import {
    DI_TOKENS,
    handleControllerError,
    json,
    parseBodyOrBadRequest,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import { SyncCalendarRequestBodySchema } from '../request/syncRequest';
import type { ICalendarSyncUsecase } from '../usecase/interface/ICalendarSyncUsecase';

@injectable()
export class CalendarSyncController {
    public constructor(
        @inject(DI_TOKENS.CalendarUsecase)
        private readonly usecase: ICalendarSyncUsecase,
    ) {}

    /**
     * POST /sync
     * body: { startDate, finishDate, raceTypeList }
     * メインAPIからレース・カレンダー登録フラグ情報を取得し、Google Calendarへ同期する。
     * @param body リクエストボディ（JSON パース済み）
     */
    public async sync(body: unknown): Promise<Response> {
        try {
            const parsed = parseBodyOrBadRequest(
                SyncCalendarRequestBodySchema,
                body,
                '不正なリクエストボディです',
            );
            if (!parsed.ok) return parsed.response;

            const result = await this.usecase.sync(parsed.value);
            return json(result);
        } catch (error) {
            return handleControllerError(error, 'CalendarSyncController.sync');
        }
    }
}
