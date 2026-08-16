import type { SearchPlaceFilterParamsInput } from '@race-schedule/core';
import {
    DI_TOKENS,
    LogAllMethods,
    type PlaceEntity,
    parsePlaceEntityUpsert,
    searchPlaceFilterParamsSchema,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IPlaceUsecase } from '../usecase/interface/IPlaceUsecase';
import { CrudController } from './crudController';

@LogAllMethods
@injectable()
export class PlaceController extends CrudController<
    PlaceEntity,
    SearchPlaceFilterParamsInput
> {
    public constructor(
        @inject(DI_TOKENS.PlaceUsecase)
        usecase: IPlaceUsecase,
    ) {
        super(usecase, {
            controllerName: 'PlaceController',
            listKey: 'places',
            filterSchema: searchPlaceFilterParamsSchema,
            parseUpsert: parsePlaceEntityUpsert,
        });
    }

    /**
     * 開催場一覧を取得するAPI
     * GET /place?startDate=2026-01-01&finishDate=2026-01-02&raceTypeList=JRA
     * @param searchParams URLSearchParams（startDate, finishDate, raceTypeList）
     * @returns 開催場一覧を含むレスポンス
     */
    public get(searchParams: URLSearchParams): Promise<Response> {
        return this.doGet(searchParams);
    }

    /**
     * 開催場情報のupsert API
     * POST /place
     * @param request HTTPリクエスト（body: 開催場エンティティ）
     * @returns upsert結果を含むレスポンス
     */
    public upsert(request: Request): Promise<Response> {
        return this.doUpsert(request);
    }
}
