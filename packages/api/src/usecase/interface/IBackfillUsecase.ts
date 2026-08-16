import type { RaceType, UpsertApiResponse } from '@race-schedule/core';

/** バックフィル対象の期間・レース種別を指定するフィルタ */
export interface BackfillFilter {
    startDate: Date;
    finishDate: Date;
    raceTypeList: RaceType[];
}

/** 開催場バックフィル結果（cacheOnlyでスキップしたタスク一覧を含む） */
export interface BackfillPlaceResult extends UpsertApiResponse {
    notCachedKeys: string[];
}

/** レースバックフィル結果（cacheOnlyでスキップしたplaceId一覧を含む） */
export interface BackfillRaceResult extends UpsertApiResponse {
    notCachedPlaceIds: string[];
}

/**
 * バックフィル（R2キャッシュのみでの再同期）ユースケースのインターフェース定義。
 * @remarks
 * scrapingへの生アクセスは一切行わず、既にR2にキャッシュされたHTMLのみを
 * 現在のパーサーで再パース・再Upsertする（`cacheOnly: true`）。
 * フロント（設定画面等）から日付範囲・レース種別を指定して実行できるようにする用途。
 */
export interface IBackfillUsecase {
    /** 指定期間・レース種別の開催場情報をキャッシュのみで再同期する */
    backfillPlace: (filter: BackfillFilter) => Promise<BackfillPlaceResult>;

    /**
     * 指定期間・レース種別のレース情報をキャッシュのみで再同期する。
     * 対象のplaceIdは自身（api）のD1から解決するため、呼び出し側はplaceIdを
     * 意識する必要が無い。
     */
    backfillRace: (filter: BackfillFilter) => Promise<BackfillRaceResult>;
}
