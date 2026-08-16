import type {
    CalendarFilterParams,
    CalendarFlagEntity,
    CalendarRaceEntity,
    RaceId,
} from '@race-schedule/core';

/**
 * Calendar に関する業務ロジック（Usecase）のインターフェース定義
 */
export interface ICalendarUsecase {
    /**
     * カレンダー掲載対象のレースを、カレンダー登録フラグ付きで取得する
     * @returns カレンダー掲載対象レースの一覧（isFlagged 付き）
     */
    fetch: (
        calendarFilterParams: CalendarFilterParams,
    ) => Promise<CalendarRaceEntity[]>;

    /**
     * 指定レース（カレンダー登録フラグ）の一覧を取得する
     * @returns フラグ付きレースの一覧
     */
    listFlags: () => Promise<CalendarFlagEntity[]>;

    /**
     * レースに指定フラグを追加する。
     * @remarks
     * Google Calendarへの反映は次回のcalendar Worker同期サイクルで行われる
     * （即時反映は行わない）。
     * @param raceId - フラグを付けるレースID（domain検証済みのRaceId型）
     * @param label - 任意のメモ
     */
    addFlag: (raceId: RaceId, label: string) => Promise<void>;

    /**
     * レースの指定フラグを削除する。
     * @remarks
     * Google Calendarからの削除は次回のcalendar Worker同期サイクルで行われる
     * （即時反映は行わない）。
     * @param raceId - フラグを外すレースID（domain検証済みのRaceId型）
     */
    removeFlag: (raceId: RaceId) => Promise<void>;
}
