import type { ReleaseNote } from '@race-schedule/core';
import { DI_TOKENS } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IMainApiRepository } from '../../repository/interface/IMainApiRepository';
import type { IReleaseNotesUsecase } from '../interface/IReleaseNotesUsecase';

@injectable()
export class ReleaseNotesUsecase implements IReleaseNotesUsecase {
    public constructor(
        @inject(DI_TOKENS.MainApiRepository)
        private readonly mainApiRepository: IMainApiRepository,
    ) {}

    public async list(): Promise<ReleaseNote[]> {
        return this.mainApiRepository.fetchReleaseNotes();
    }
}
