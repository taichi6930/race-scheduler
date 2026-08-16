import type { RaceType } from '@race-schedule/core';
import type { calendar_v3 } from 'googleapis';

/**
 * Googleカレンダー連携用ゲートウェイインターフェース
 * - イベントの取得・作成・更新・削除を担当
 * - Google Calendar API v3を利用
 */
export interface IGoogleCalendarGateway {
    /**
     * 指定期間のカレンダーイベントを全件取得
     * @param raceType レース種別
     * @param startDate 開始日
     * @param finishDate 終了日
     */
    fetchCalendarDataList: (
        raceType: RaceType,
        startDate: Date,
        finishDate: Date,
    ) => Promise<calendar_v3.Schema$Event[]>;

    /**
     * 指定IDのカレンダーイベントを取得
     * @param raceType レース種別
     * @param eventId イベントID
     */
    fetchCalendarData: (
        raceType: RaceType,
        eventId: string,
    ) => Promise<calendar_v3.Schema$Event>;

    /**
     * カレンダーイベントを更新
     * @param raceType レース種別
     * @param calendarData 更新データ（eventId必須）
     */
    updateCalendarData: (
        raceType: RaceType,
        calendarData: calendar_v3.Schema$Event,
    ) => Promise<void>;

    /**
     * 新規カレンダーイベントを作成
     * @param raceType レース種別
     * @param calendarData 作成データ（eventId不要）
     */
    insertCalendarData: (
        raceType: RaceType,
        calendarData: calendar_v3.Schema$Event,
    ) => Promise<string>; // returns created event id

    /**
     * カレンダーイベントを削除
     * @param raceType レース種別
     * @param eventId イベントID
     */
    deleteCalendarData: (raceType: RaceType, eventId: string) => Promise<void>;
}
