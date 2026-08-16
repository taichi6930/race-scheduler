import { createMockFn, type Mocked } from '@race-schedule/core/test';

import { IRaceRepository } from '../../../src/repository/interface';

export const mockRaceRepository = (): Mocked<IRaceRepository> => ({
    fetch: createMockFn<IRaceRepository['fetch']>(),
    upsert: createMockFn<IRaceRepository['upsert']>(),
    fetchByRaceId: createMockFn<IRaceRepository['fetchByRaceId']>(),
    fetchWatchedRaceIds: createMockFn<IRaceRepository['fetchWatchedRaceIds']>(),
    fetchRacePlayers: createMockFn<IRaceRepository['fetchRacePlayers']>(),
});
