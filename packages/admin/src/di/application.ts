import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { BackfillUsecase } from '../usecase/implement/backfillUsecase';
import { FeatureFlagsUsecase } from '../usecase/implement/featureFlagsUsecase';
import { RaceDetailLayoutUsecase } from '../usecase/implement/raceDetailLayoutUsecase';
import type { IBackfillUsecase } from '../usecase/interface/IBackfillUsecase';
import type { IFeatureFlagsUsecase } from '../usecase/interface/IFeatureFlagsUsecase';
import type { IRaceDetailLayoutUsecase } from '../usecase/interface/IRaceDetailLayoutUsecase';

/**
 * アプリケーション層（Usecase）のDI登録
 */
export function registerApplication(): void {
    container.register<IFeatureFlagsUsecase>(DI_TOKENS.FeatureFlagUsecase, {
        useClass: FeatureFlagsUsecase,
    });
    container.register<IBackfillUsecase>(DI_TOKENS.BackfillUsecase, {
        useClass: BackfillUsecase,
    });
    container.register<IRaceDetailLayoutUsecase>(DI_TOKENS.UiLayoutUsecase, {
        useClass: RaceDetailLayoutUsecase,
    });
}
