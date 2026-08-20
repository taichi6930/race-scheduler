import { DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { BackfillUsecase } from '../usecase/implement/backfillUsecase';
import { FeatureFlagsUsecase } from '../usecase/implement/featureFlagsUsecase';
import { InviteUsecase } from '../usecase/implement/inviteUsecase';
import { ParticipantsUsecase } from '../usecase/implement/participantsUsecase';
import { RaceDetailLayoutUsecase } from '../usecase/implement/raceDetailLayoutUsecase';
import { ReleaseNotesUsecase } from '../usecase/implement/releaseNotesUsecase';
import type { IBackfillUsecase } from '../usecase/interface/IBackfillUsecase';
import type { IFeatureFlagsUsecase } from '../usecase/interface/IFeatureFlagsUsecase';
import type { IInviteUsecase } from '../usecase/interface/IInviteUsecase';
import type { IParticipantsUsecase } from '../usecase/interface/IParticipantsUsecase';
import type { IRaceDetailLayoutUsecase } from '../usecase/interface/IRaceDetailLayoutUsecase';
import type { IReleaseNotesUsecase } from '../usecase/interface/IReleaseNotesUsecase';
import { ADMIN_DI_TOKENS } from './tokens';

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
    container.register<IReleaseNotesUsecase>(DI_TOKENS.ReleaseNoteUsecase, {
        useClass: ReleaseNotesUsecase,
    });
    container.register<IInviteUsecase>(ADMIN_DI_TOKENS.InviteUsecase, {
        useClass: InviteUsecase,
    });
    container.register<IParticipantsUsecase>(
        ADMIN_DI_TOKENS.ParticipantsUsecase,
        { useClass: ParticipantsUsecase },
    );
}
