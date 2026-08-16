import { createMockFn, type Mocked } from '@race-schedule/core/test';

import { IPushRequestRepository } from '../../../src/repository/interface';

export const mockPushRequestRepository =
    (): Mocked<IPushRequestRepository> => ({
        upsert: createMockFn<IPushRequestRepository['upsert']>(),
        remove: createMockFn<IPushRequestRepository['remove']>(),
        removeBySubscriptionId:
            createMockFn<IPushRequestRepository['removeBySubscriptionId']>(),
        fetchDue: createMockFn<IPushRequestRepository['fetchDue']>(() =>
            Promise.resolve([]),
        ),
        markSent: createMockFn<IPushRequestRepository['markSent']>(),
        markSentBatch: createMockFn<IPushRequestRepository['markSentBatch']>(),
        releaseClaim: createMockFn<IPushRequestRepository['releaseClaim']>(),
        releaseClaimBatch:
            createMockFn<IPushRequestRepository['releaseClaimBatch']>(),
        purgeOld: createMockFn<IPushRequestRepository['purgeOld']>(),
    });
