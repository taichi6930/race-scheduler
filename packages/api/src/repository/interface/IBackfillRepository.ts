import type {
    ScrapingSyncPlaceParams,
    ScrapingSyncPlaceResult,
    ScrapingSyncRaceParams,
    ScrapingSyncRaceResult,
} from '../../gateway/interface/IScrapingApiGateway';

/**
 * バックフィル（R2キャッシュのみでの再同期）を scraping Worker へ依頼するリポジトリの
 * インターフェース定義。
 * @remarks
 * ScrapingApiGateway（HTTP通信の詳細）をラップし、Usecase から見た
 * 「開催場・レースのキャッシュオンリー再同期」というドメイン操作を提供する。
 */
export interface IBackfillRepository {
    /** 開催場情報をキャッシュのみで再同期する */
    syncPlace: (
        params: ScrapingSyncPlaceParams,
    ) => Promise<ScrapingSyncPlaceResult>;

    /** レース情報をキャッシュのみで再同期する */
    syncRace: (
        params: ScrapingSyncRaceParams,
    ) => Promise<ScrapingSyncRaceResult>;
}
