import type { CalendarFlagEntity, RaceId } from '@race-schedule/core';

/**
 * 指定レース（カレンダー登録フラグ）リポジトリのインターフェース定義
 */
export interface ICalendarRepository {
    /**
     * 指定した raceId のうち、フラグが付いているものの集合を取得する
     * @remarks
     * カレンダー登録フィルタ（shouldIncludeInCalendar）で「フラグ付きか」を
     * O(1) 判定するために Set で返す。呼び出し側が既に日付範囲でレースを
     * 取得済みのため、それらの raceId に絞ったIN句クエリで十分
     * （PERF-179: 全件取得だと運用長期化でcalendar_flagテーブルが線形に
     * 肥大化するのに対し、この絞り込みならコストは呼び出し側のレース件数に比例する）
     * @param raceIds - 絞り込み対象の raceId 一覧（空配列の場合はDBへ問い合わせず空のSetを返す）
     * @returns 指定raceIdのうちフラグ付きのものの集合
     */
    fetchFlaggedRaceIds: (raceIds: readonly string[]) => Promise<Set<string>>;

    /**
     * フラグ一覧を取得する
     * @returns フラグ付きレースの一覧（raceId, label）
     */
    list: () => Promise<CalendarFlagEntity[]>;

    /**
     * レースにフラグを追加する（既に存在する場合は label を更新）
     * @param raceId - フラグを付けるレースID（domain検証済みのRaceId型）
     * @param label - 任意のメモ（例: 「一口:○○号」）
     */
    add: (raceId: RaceId, label: string) => Promise<void>;

    /**
     * レースのフラグを削除する
     * @param raceId - フラグを外すレースID（domain検証済みのRaceId型）
     */
    remove: (raceId: RaceId) => Promise<void>;
}
