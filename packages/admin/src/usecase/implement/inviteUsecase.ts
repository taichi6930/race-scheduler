import { DI_TOKENS } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { InviteIssueResult } from '../../dto/invite';
import type { IMainApiRepository } from '../../repository/interface/IMainApiRepository';
import type { IInviteUsecase } from '../interface/IInviteUsecase';

@injectable()
export class InviteUsecase implements IInviteUsecase {
    public constructor(
        @inject(DI_TOKENS.MainApiRepository)
        private readonly mainApiRepository: IMainApiRepository,
    ) {}

    public async issueInvite(memo: string | null): Promise<InviteIssueResult> {
        return this.mainApiRepository.issueInvite(memo);
    }
}
