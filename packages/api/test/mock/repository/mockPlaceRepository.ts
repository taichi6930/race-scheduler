import { createMockFn, type Mocked } from '@race-schedule/core/test';
import type { IPlaceRepository } from '../../../src/repository/interface';

export const mockPlaceRepository = (): Mocked<IPlaceRepository> => ({
    fetch: createMockFn<IPlaceRepository['fetch']>(),
    upsert: createMockFn<IPlaceRepository['upsert']>(),
});
