import { DI_TOKENS } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { ParticipantSummary } from '../../dto/participant';
import type { IMainApiRepository } from '../../repository/interface/IMainApiRepository';
import type { IParticipantsUsecase } from '../interface/IParticipantsUsecase';

@injectable()
export class ParticipantsUsecase implements IParticipantsUsecase {
    public constructor(
        @inject(DI_TOKENS.MainApiRepository)
        private readonly mainApiRepository: IMainApiRepository,
    ) {}

    public async list(): Promise<ParticipantSummary[]> {
        return this.mainApiRepository.fetchParticipants();
    }
}
