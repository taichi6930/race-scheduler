import type {
    PlayerEntity,
    SearchPlayerFilterParamsInput,
    UpsertResult,
} from '@race-schedule/core';

/**
 * Player UseCase Interface
 */
export interface IPlayerUsecase {
    fetch: (
        searchPlayerFilter: SearchPlayerFilterParamsInput,
    ) => Promise<PlayerEntity[]>;

    upsert: (entityList: PlayerEntity[]) => Promise<UpsertResult>;
}
