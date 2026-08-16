import { DI_TOKENS } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type {
    BackfillFilter,
    BackfillPlaceResult,
    BackfillRaceResult,
} from '../../dto/backfillResult';
import type { IMainApiRepository } from '../../repository/interface/IMainApiRepository';
import type { IBackfillUsecase } from '../interface/IBackfillUsecase';

@injectable()
export class BackfillUsecase implements IBackfillUsecase {
    public constructor(
        @inject(DI_TOKENS.MainApiRepository)
        private readonly mainApiRepository: IMainApiRepository,
    ) {}

    public async backfillPlace(
        filter: BackfillFilter,
    ): Promise<BackfillPlaceResult> {
        return this.mainApiRepository.backfillPlace(filter);
    }

    public async backfillRace(
        filter: BackfillFilter,
    ): Promise<BackfillRaceResult> {
        return this.mainApiRepository.backfillRace(filter);
    }
}
