import { DI_TOKENS } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { FeatureFlagStatus } from '../../dto/featureFlagStatus';
import type { IMainApiRepository } from '../../repository/interface/IMainApiRepository';
import type { IFeatureFlagsUsecase } from '../interface/IFeatureFlagsUsecase';

@injectable()
export class FeatureFlagsUsecase implements IFeatureFlagsUsecase {
    public constructor(
        @inject(DI_TOKENS.MainApiRepository)
        private readonly mainApiRepository: IMainApiRepository,
    ) {}

    public async list(): Promise<FeatureFlagStatus[]> {
        return this.mainApiRepository.fetchFeatureFlagList();
    }

    public async setFlag(
        key: string,
        enabled: boolean,
    ): Promise<FeatureFlagStatus[]> {
        return this.mainApiRepository.updateFeatureFlag(key, enabled);
    }
}
