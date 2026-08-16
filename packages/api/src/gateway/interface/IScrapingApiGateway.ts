import type {
    PlaceHeldDays,
    RaceType,
    UpsertApiResponse,
} from '@race-schedule/core';

/** POST /sync/place（scraping Worker）呼び出しのパラメータ */
export interface ScrapingSyncPlaceParams {
    startDate: Date;
    finishDate: Date;
    raceTypeList: RaceType[];
    /** trueの場合、R2にキャッシュが無いタスクは生スクレイピングせずスキップする */
    cacheOnly: boolean;
}

/** POST /sync/race（scraping Worker）呼び出しのパラメータ */
export interface ScrapingSyncRaceParams {
    placeIdList: string[];
    placeHeldDaysMap?: Record<string, PlaceHeldDays>;
    /** trueの場合、R2にキャッシュが無いplaceIdは生スクレイピングせずスキップする */
    cacheOnly: boolean;
}

/** scraping WorkerのPOST /sync/placeレスポンス（cacheOnlyでスキップしたタスク一覧を含む） */
export interface ScrapingSyncPlaceResult extends UpsertApiResponse {
    notCachedKeys: string[];
}

/** scraping WorkerのPOST /sync/raceレスポンス（cacheOnlyでスキップしたplaceId一覧を含む） */
export interface ScrapingSyncRaceResult extends UpsertApiResponse {
    notCachedPlaceIds: string[];
}

/**
 * scraping Worker（@race-schedule/scraping）のPOST /sync/race・POST /sync/place を
 * 呼び出すゲートウェイのインターフェース定義（バックフィル機能専用）。
 * @remarks
 * `packages/scraping/src/gateway/interface/IMainApiGateway.ts`（scraping→api方向）と
 * 対になる、api→scraping方向の通信を担う。
 */
export interface IScrapingApiGateway {
    /** 開催場情報をキャッシュのみで再同期する */
    syncPlace: (
        params: ScrapingSyncPlaceParams,
    ) => Promise<ScrapingSyncPlaceResult>;

    /** レース情報をキャッシュのみで再同期する */
    syncRace: (
        params: ScrapingSyncRaceParams,
    ) => Promise<ScrapingSyncRaceResult>;
}
