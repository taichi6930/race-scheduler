import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type {
    IScrapingApiGateway,
    ScrapingSyncPlaceParams,
    ScrapingSyncPlaceResult,
    ScrapingSyncRaceParams,
    ScrapingSyncRaceResult,
} from '../../gateway/interface/IScrapingApiGateway';
import type { IBackfillRepository } from '../interface/IBackfillRepository';

/**
 * バックフィルリポジトリ実装
 * @remarks
 * ScrapingApiGatewayへの薄い委譲のみを行う（層境界を保つため）。
 */
@LogAllMethods
@injectable()
export class BackfillRepository implements IBackfillRepository {
    public constructor(
        @inject(DI_TOKENS.ScrapingApiGateway)
        private readonly scrapingApiGateway: IScrapingApiGateway,
    ) {}

    public syncPlace(
        params: ScrapingSyncPlaceParams,
    ): Promise<ScrapingSyncPlaceResult> {
        return this.scrapingApiGateway.syncPlace(params);
    }

    public syncRace(
        params: ScrapingSyncRaceParams,
    ): Promise<ScrapingSyncRaceResult> {
        return this.scrapingApiGateway.syncRace(params);
    }
}
