import type { SearchPlaceFilterParamsInput } from '@race-schedule/core';
import {
    DI_TOKENS,
    LogAllMethods,
    type PlaceEntity,
    type UpsertResult,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IPlaceRepository } from '../../repository/interface/IPlaceRepository';
import type { IPlaceUsecase } from '../interface/IPlaceUsecase';
import { CrudUsecase } from './crudUsecase';

/**
 * 開催場情報取得ユースケース実装
 */
@LogAllMethods
@injectable()
export class PlaceUsecase
    extends CrudUsecase<PlaceEntity, SearchPlaceFilterParamsInput>
    implements IPlaceUsecase
{
    public constructor(
        @inject(DI_TOKENS.PlaceRepository)
        placeRepository: IPlaceRepository,
    ) {
        super(placeRepository);
    }

    /**
     * 開催場情報を取得
     * @param searchPlaceFilterParams - domain検証済みのフィルターパラメータ
     */
    public fetch(
        searchPlaceFilterParams: SearchPlaceFilterParamsInput,
    ): Promise<PlaceEntity[]> {
        return this.doFetch(searchPlaceFilterParams);
    }

    /**
     * 開催場情報を登録/更新
     * @param entityList - domain検証済みのPlaceEntityリスト
     */
    public upsert(entityList: PlaceEntity[]): Promise<UpsertResult> {
        return this.doUpsert(entityList);
    }
}
