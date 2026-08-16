import {
    DI_TOKENS,
    type RaceDetailUi,
    type RaceDetailUiConfig,
    type RaceType,
} from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { RaceSummary } from '../../dto/raceSummary';
import type { IMainApiRepository } from '../../repository/interface/IMainApiRepository';
import type { IRaceDetailLayoutUsecase } from '../interface/IRaceDetailLayoutUsecase';

@injectable()
export class RaceDetailLayoutUsecase implements IRaceDetailLayoutUsecase {
    public constructor(
        @inject(DI_TOKENS.MainApiRepository)
        private readonly mainApiRepository: IMainApiRepository,
    ) {}

    public async getConfig(raceType: RaceType): Promise<RaceDetailUiConfig> {
        return this.mainApiRepository.fetchUiLayout(raceType);
    }

    public async saveConfig(
        raceType: RaceType,
        config: RaceDetailUiConfig,
    ): Promise<RaceDetailUiConfig> {
        return this.mainApiRepository.saveUiLayout(raceType, config);
    }

    public async previewConfig(
        config: RaceDetailUiConfig,
        raceId: string,
    ): Promise<RaceDetailUi | undefined> {
        return this.mainApiRepository.previewUiLayout(config, raceId);
    }

    public async listPreviewCandidates(days: number): Promise<RaceSummary[]> {
        const races =
            await this.mainApiRepository.fetchUpcomingKeirinRaces(days);
        return [...races].sort((a, b) => a.datetime.localeCompare(b.datetime));
    }
}
