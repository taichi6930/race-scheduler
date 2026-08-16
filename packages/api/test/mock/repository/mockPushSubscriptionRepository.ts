import { createMockFn, type Mocked } from '@race-schedule/core/test';

import { IPushSubscriptionRepository } from '../../../src/repository/interface';

export const mockPushSubscriptionRepository =
    (): Mocked<IPushSubscriptionRepository> => ({
        upsert: createMockFn<IPushSubscriptionRepository['upsert']>(),
        remove: createMockFn<IPushSubscriptionRepository['remove']>(),
        removeWithDependentRequests:
            createMockFn<
                IPushSubscriptionRepository['removeWithDependentRequests']
            >(),
        removeWithDependentRequestsBatch:
            createMockFn<
                IPushSubscriptionRepository['removeWithDependentRequestsBatch']
            >(),
        findById: createMockFn<IPushSubscriptionRepository['findById']>(),
        incrementFailureCount:
            createMockFn<
                IPushSubscriptionRepository['incrementFailureCount']
            >(),
        incrementFailureCountBatch: createMockFn<
            IPushSubscriptionRepository['incrementFailureCountBatch']
        >(() => Promise.resolve(new Map())),
        resetFailureCount:
            createMockFn<IPushSubscriptionRepository['resetFailureCount']>(),
        resetFailureCountBatch:
            createMockFn<
                IPushSubscriptionRepository['resetFailureCountBatch']
            >(),
        findSecretHashById:
            createMockFn<IPushSubscriptionRepository['findSecretHashById']>(),
        purgeStale: createMockFn<IPushSubscriptionRepository['purgeStale']>(
            () => Promise.resolve(0),
        ),
    });
