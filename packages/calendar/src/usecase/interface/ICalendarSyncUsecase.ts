import type {
    CalendarFilterParams,
    CalendarUpsertResult,
} from '@race-schedule/core';

/**
 * カレンダー同期Usecaseのインターフェース
 */
export interface ICalendarSyncUsecase {
    /**
     * メインAPIからレース・カレンダー登録フラグ情報を取得し、Google Calendarへ同期する
     * @param params - 同期対象の期間・レース種別
     */
    sync: (params: CalendarFilterParams) => Promise<CalendarUpsertResult>;
}
