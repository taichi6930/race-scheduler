import type {
    PlaceEntity,
    SearchPlaceFilterParamsInput,
    UpsertResult,
} from '@race-schedule/core';

/**
 * レース開催場所ユースケースのインターフェース
 */
export interface IPlaceUsecase {
    /**
     * レース開催場所のEntity配列を取得する
     * @param searchPlaceFilterParams - 場所フィルター情報
     */
    fetch: (
        searchPlaceFilterParams: SearchPlaceFilterParamsInput,
    ) => Promise<PlaceEntity[]>;

    /**
     * レース開催場所のEntity配列の更新を行う
     * @param entityList - レース開催場所エンティティ配列
     */
    upsert: (entityList: PlaceEntity[]) => Promise<UpsertResult>;
}
