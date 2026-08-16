import { createMockFn, type Mocked } from '@race-schedule/core/test';

import { IPlayerRepository } from '../../../src/repository/interface';

export const mockPlayerRepository = (): Mocked<IPlayerRepository> => ({
    fetch: createMockFn<IPlayerRepository['fetch']>(),
    upsert: createMockFn<IPlayerRepository['upsert']>(),
});
