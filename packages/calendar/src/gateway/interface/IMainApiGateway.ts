import type {
    CalendarFlagEntity,
    RaceEntity,
    RaceType,
} from '@race-schedule/core';

/**
 * レース検索フィルタ（メインAPI /race 呼び出し用）
 */
export interface MainApiRaceFilter {
    startDate: Date;
    finishDate: Date;
    raceTypeList: RaceType[];
}

/**
 * メインAPI（@race-schedule/api）からレース・カレンダーフラグ情報を取得するゲートウェイ
 */
export interface IMainApiGateway {
    /**
     * 指定条件のレース一覧をメインAPIから取得する
     * @param filter 検索条件（期間・レース種別）
     */
    fetchRaceList: (filter: MainApiRaceFilter) => Promise<RaceEntity[]>;

    /**
     * カレンダー登録フラグの一覧をメインAPIから取得する
     */
    fetchCalendarFlagList: () => Promise<CalendarFlagEntity[]>;
}
