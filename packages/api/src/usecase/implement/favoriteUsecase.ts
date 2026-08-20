import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { inject, injectable } from 'tsyringe';

import type { IFavoriteRepository } from '../../repository/interface/IFavoriteRepository';
import type { IFavoriteUsecase } from '../interface/IFavoriteUsecase';

@LogAllMethods
@injectable()
export class FavoriteUsecase implements IFavoriteUsecase {
    public constructor(
        @inject(DI_TOKENS.FavoriteRepository)
        private readonly repository: IFavoriteRepository,
    ) {}

    public fetch(userId: string): Promise<string[]> {
        return this.repository.fetch(userId);
    }

    public add(userId: string, raceId: string): Promise<void> {
        return this.repository.add(userId, raceId);
    }

    public remove(userId: string, raceId: string): Promise<void> {
        return this.repository.remove(userId, raceId);
    }
}
