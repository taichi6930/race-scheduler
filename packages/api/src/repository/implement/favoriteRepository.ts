import { DI_TOKENS, LogAllMethods } from '@race-schedule/core';
import { and, eq } from 'drizzle-orm';
import { inject, injectable } from 'tsyringe';

import { favorite } from '../../db/schema';
import type { IDrizzleGateway } from '../../gateway/interface/IDrizzleGateway';
import type { IFavoriteRepository } from '../interface/IFavoriteRepository';

@LogAllMethods
@injectable()
export class FavoriteRepository implements IFavoriteRepository {
    public constructor(
        @inject(DI_TOKENS.DrizzleGateway)
        private readonly drizzleGateway: IDrizzleGateway,
    ) {}

    public async fetch(userId: string): Promise<string[]> {
        const rows = await this.drizzleGateway.db
            .select({ raceId: favorite.raceId })
            .from(favorite)
            .where(eq(favorite.userId, userId));
        return rows.map((row) => row.raceId);
    }

    public async add(userId: string, raceId: string): Promise<void> {
        await this.drizzleGateway.db
            .insert(favorite)
            .values({ userId, raceId })
            .onConflictDoNothing();
    }

    public async remove(userId: string, raceId: string): Promise<void> {
        await this.drizzleGateway.db
            .delete(favorite)
            .where(
                and(eq(favorite.userId, userId), eq(favorite.raceId, raceId)),
            );
    }
}
