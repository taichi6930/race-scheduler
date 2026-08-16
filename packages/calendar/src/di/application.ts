import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { CalendarSyncUsecase } from '../usecase/implement/calendarSyncUsecase';
import type { ICalendarSyncUsecase } from '../usecase/interface/ICalendarSyncUsecase';

/**
 * アプリケーション層（Usecase）のDI登録
 */
export function registerApplication(): void {
    container.register<ICalendarSyncUsecase>(DI_TOKENS.CalendarUsecase, {
        useClass: CalendarSyncUsecase,
    });
}
