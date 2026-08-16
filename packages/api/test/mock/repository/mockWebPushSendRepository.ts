import { createMockFn, type Mocked } from '@race-schedule/core/test';

import { IWebPushSendRepository } from '../../../src/repository/interface';

export const mockWebPushSendRepository =
    (): Mocked<IWebPushSendRepository> => ({
        send: createMockFn<IWebPushSendRepository['send']>(),
    });
