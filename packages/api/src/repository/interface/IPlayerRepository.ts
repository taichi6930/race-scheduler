import type {
    PlayerEntity,
    SearchPlayerFilterParamsInput,
    UpsertResult,
} from '@race-schedule/core';

/**
 * Player Repository Interface
 */
export interface IPlayerRepository {
    fetch: (
        searchPlayerFilter: SearchPlayerFilterParamsInput,
    ) => Promise<PlayerEntity[]>;

    upsert: (entityList: PlayerEntity[]) => Promise<UpsertResult>;
}
