import type {
    CalendarFilterParams,
    CalendarFlagEntity,
    RaceEntity,
} from '@race-schedule/core';

/**
 * メインAPI（@race-schedule/api）から同期元データを取得するリポジトリのインターフェース定義
 * @remarks
 * MainApiGateway（HTTP通信の詳細）をラップし、Usecase から見た
 * 「レース・カレンダーフラグの取得」というドメイン操作を提供する。
 * Usecase は Gateway を直接触らず、この Repository 経由でデータへアクセスする
 * （controller → usecase → repository → gateway の層順序を守るため）。
 */
export interface IMainApiRepository {
    /**
     * 指定条件のレース一覧をメインAPIから取得する
     * @param filter 検索条件（期間・レース種別）
     */
    fetchRaceList: (filter: CalendarFilterParams) => Promise<RaceEntity[]>;

    /**
     * カレンダー登録フラグの一覧をメインAPIから取得する
     */
    fetchCalendarFlagList: () => Promise<CalendarFlagEntity[]>;
}
