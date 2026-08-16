import { createMockFn, type Mocked } from '@race-schedule/core/test';

import { ICalendarRepository } from '../../../src/repository/interface';

export const mockCalendarRepository = (): Mocked<ICalendarRepository> => ({
    fetchFlaggedRaceIds:
        createMockFn<ICalendarRepository['fetchFlaggedRaceIds']>(),
    list: createMockFn<ICalendarRepository['list']>(),
    add: createMockFn<ICalendarRepository['add']>(),
    remove: createMockFn<ICalendarRepository['remove']>(),
});
