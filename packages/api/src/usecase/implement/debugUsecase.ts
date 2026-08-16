import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type {
    DatabaseTableCounts,
    IDebugRepository,
} from '../../repository/interface/IDebugRepository';
import type { IDebugUsecase } from '../interface/IDebugUsecase';

@LogAllMethods
@injectable()
export class DebugUsecase implements IDebugUsecase {
    public constructor(
        @inject(DI_TOKENS.DebugRepository)
        private readonly debugRepository: IDebugRepository,
    ) {}

    public countRaceAndRaceCondition(): Promise<DatabaseTableCounts> {
        return this.debugRepository.countRaceAndRaceCondition();
    }
}
