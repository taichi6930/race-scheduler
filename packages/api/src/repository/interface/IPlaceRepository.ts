import type {
    PlaceEntity,
    SearchPlaceFilterParamsInput,
    UpsertResult,
} from '@race-schedule/core';

/**
 * 開催場情報取得リポジトリのインターフェース
 */
export interface IPlaceRepository {
    /**
     * 開催場Entity配列を取得する
     * @param searchPlaceFilterParams - 場所フィルター情報
     */
    fetch: (
        searchPlaceFilterParams: SearchPlaceFilterParamsInput,
    ) => Promise<PlaceEntity[]>;

    /**
     * 開催場Entity配列をupsertする
     * @param entityList - upsert対象のEntity配列
     */
    upsert: (entityList: PlaceEntity[]) => Promise<UpsertResult>;
}
