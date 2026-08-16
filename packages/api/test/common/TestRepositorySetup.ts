import type { Mocked } from '../../../../tests/shared/testUtilities';
import type {
    ICalendarRepository,
    IPlaceRepository,
    IPlayerRepository,
    IPushRequestRepository,
    IPushSubscriptionRepository,
    IRaceRepository,
    IUiLayoutRepository,
    IWebPushSendRepository,
} from '../../src/repository/interface';

// Repositoryモックの型
export interface TestRepositorySetup {
    raceRepository: Mocked<IRaceRepository>;
    playerRepository: Mocked<IPlayerRepository>;
    placeRepository: Mocked<IPlaceRepository>;
    calendarRepository: Mocked<ICalendarRepository>;
    pushSubscriptionRepository: Mocked<IPushSubscriptionRepository>;
    pushRequestRepository: Mocked<IPushRequestRepository>;
    webPushSendRepository: Mocked<IWebPushSendRepository>;
    uiLayoutRepository: Mocked<IUiLayoutRepository>;
}
