import type { PlaceEntity, PlaceHeldDays } from '@race-schedule/core';
import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IBackfillRepository } from '../../repository/interface/IBackfillRepository';
import type { IPlaceRepository } from '../../repository/interface/IPlaceRepository';
import type {
    BackfillFilter,
    BackfillPlaceResult,
    BackfillRaceResult,
    IBackfillUsecase,
} from '../interface/IBackfillUsecase';

/**
 * 開催場エンティティ一覧から、JRAのplaceHeldDaysを持つもののみを
 * `placeId -> placeHeldDays` のマップへ変換する。
 * @param placeEntityList - 開催場エンティティ一覧
 * @returns placeId をキーとした placeHeldDays のマップ
 */
const buildPlaceHeldDaysMap = (
    placeEntityList: PlaceEntity[],
): Record<string, PlaceHeldDays> => {
    const map: Record<string, PlaceHeldDays> = {};
    for (const entity of placeEntityList) {
        if (entity.placeHeldDays) {
            map[entity.placeId] = entity.placeHeldDays;
        }
    }
    return map;
};

/**
 * バックフィル（R2キャッシュのみでの再同期）ユースケース実装
 */
@LogAllMethods
@injectable()
export class BackfillUsecase implements IBackfillUsecase {
    public constructor(
        @inject(DI_TOKENS.PlaceRepository)
        private readonly placeRepository: IPlaceRepository,
        @inject(DI_TOKENS.BackfillRepository)
        private readonly backfillRepository: IBackfillRepository,
    ) {}

    public async backfillPlace(
        filter: BackfillFilter,
    ): Promise<BackfillPlaceResult> {
        return this.backfillRepository.syncPlace({
            startDate: filter.startDate,
            finishDate: filter.finishDate,
            raceTypeList: filter.raceTypeList,
            cacheOnly: true,
        });
    }

    public async backfillRace(
        filter: BackfillFilter,
    ): Promise<BackfillRaceResult> {
        const placeEntityList = await this.placeRepository.fetch({
            startDate: filter.startDate,
            finishDate: filter.finishDate,
            raceTypeList: filter.raceTypeList,
        });

        if (placeEntityList.length === 0) {
            return {
                successCount: 0,
                failureCount: 0,
                failures: [],
                notCachedPlaceIds: [],
            };
        }

        return this.backfillRepository.syncRace({
            placeIdList: placeEntityList.map((entity) => entity.placeId),
            placeHeldDaysMap: buildPlaceHeldDaysMap(placeEntityList),
            cacheOnly: true,
        });
    }
}
