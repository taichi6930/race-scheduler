import { createMockFn, type Mocked } from '@race-schedule/core/test';

import type { IUiLayoutRepository } from '../../../src/repository/interface/IUiLayoutRepository';

export const mockUiLayoutRepository = (): Mocked<IUiLayoutRepository> => ({
    get: createMockFn<IUiLayoutRepository['get']>(),
    upsert: createMockFn<IUiLayoutRepository['upsert']>(),
});
