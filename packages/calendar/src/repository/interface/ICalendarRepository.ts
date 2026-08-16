import type {
    CalendarDataEntity,
    CalendarFilterParams,
    CalendarUpsertResult,
    RaceEntity,
    RaceId,
    RaceType,
} from '@race-schedule/core';

/**
 * カレンダーリポジトリのインターフェース定義
 */
export interface ICalendarRepository {
    /**
     * カレンダーデータを取得する
     * @param params - カレンダー検索フィルター
     * @returns カレンダーデータ一覧
     */
    fetch: (params: CalendarFilterParams) => Promise<CalendarDataEntity[]>;

    /**
     * カレンダーデータを登録・更新する
     * @param params - 対象期間・レース種別
     * （raceType単位で現在のイベント一覧を事前取得する際の取得期間として使う。
     * cleanseStaleEvents に渡すものと同じ params を渡すことで、内部キャッシュを
     * 共有し重複取得を避けられる。PERF-072/073）
     * @param raceEntityList - 登録・更新するカレンダーデータ
     * @returns 登録・更新結果
     */
    upsert: (
        params: CalendarFilterParams,
        raceEntityList: RaceEntity[],
    ) => Promise<CalendarUpsertResult>;

    /**
     * Google Calendar 上の不要なイベントを削除する
     *
     * 指定期間のカレンダーをスキャンし、validRaceEntityList に含まれない
     * イベントを削除する（例: レース番号変更後の残留イベント）
     * @param params - 対象期間・レース種別
     * @param validRaceEntityList - 有効なレースエンティティ一覧（カレンダー掲載フィルタ後）
     * @param fetchedRaceEntityList - 今回DBから実際に取得できたレースエンティティ一覧
     * （フィルタ前。開催場・日付単位で「今回確定情報を取得できたか」の判定に使う。
     * これに含まれない開催場・日付のイベントは、DBが未取得なだけの可能性があるため削除対象にしない）
     * @returns 削除結果
     */
    cleanseStaleEvents: (
        params: CalendarFilterParams,
        validRaceEntityList: RaceEntity[],
        fetchedRaceEntityList: RaceEntity[],
    ) => Promise<CalendarUpsertResult>;

    /**
     * raceId を指定してカレンダーイベントを1件削除する
     * @remarks
     * フラグ解除時の即時削除用。イベントが元々存在しない場合も
     * エラーにはせず、警告ログのみ出して正常終了する（冪等な削除）。
     * @param raceType - 対象のレース種別（カレンダーの選択に使用）
     * @param raceId - 削除対象のレースID（domain検証済みのRaceId型）
     */
    deleteById: (raceType: RaceType, raceId: RaceId) => Promise<void>;
}
