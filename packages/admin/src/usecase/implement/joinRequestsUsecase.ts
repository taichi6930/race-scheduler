import { DI_TOKENS } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { JoinRequestSummary } from '../../dto/joinRequest';
import type { IMainApiRepository } from '../../repository/interface/IMainApiRepository';
import type { IJoinRequestsUsecase } from '../interface/IJoinRequestsUsecase';

@injectable()
export class JoinRequestsUsecase implements IJoinRequestsUsecase {
    public constructor(
        @inject(DI_TOKENS.MainApiRepository)
        private readonly mainApiRepository: IMainApiRepository,
    ) {}

    public async list(): Promise<JoinRequestSummary[]> {
        return this.mainApiRepository.fetchJoinRequests();
    }

    public async approve(id: string): Promise<void> {
        return this.mainApiRepository.approveJoinRequest(id);
    }

    public async reject(id: string): Promise<void> {
        return this.mainApiRepository.rejectJoinRequest(id);
    }
}
