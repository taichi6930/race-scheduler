import 'reflect-metadata';

import { container } from 'tsyringe';

import type { ICalendarRepository } from '../src/repository/interface/ICalendarRepository';
import type { IPlaceRepository } from '../src/repository/interface/IPlaceRepository';
import type { IPlayerRepository } from '../src/repository/interface/IPlayerRepository';
import type { IPushRequestRepository } from '../src/repository/interface/IPushRequestRepository';
import type { IPushSubscriptionRepository } from '../src/repository/interface/IPushSubscriptionRepository';
import type { IRaceRepository } from '../src/repository/interface/IRaceRepository';
import type { IUiLayoutRepository } from '../src/repository/interface/IUiLayoutRepository';
import type { IWebPushSendRepository } from '../src/repository/interface/IWebPushSendRepository';
import type { TestRepositorySetup } from './common';
import { mockCalendarRepository } from './mock/repository/mockCalendarRepository';
import { mockPlaceRepository } from './mock/repository/mockPlaceRepository';
import { mockPlayerRepository } from './mock/repository/mockPlayerRepository';
import { mockPushRequestRepository } from './mock/repository/mockPushRequestRepository';
import { mockPushSubscriptionRepository } from './mock/repository/mockPushSubscriptionRepository';
import { mockRaceRepository } from './mock/repository/mockRaceRepository';
import { mockUiLayoutRepository } from './mock/repository/mockUiLayoutRepository';
import { mockWebPushSendRepository } from './mock/repository/mockWebPushSendRepository';

// RepositoryモックをDIコンテナへ登録し返却
export const setupTestRepositoryMock = (): TestRepositorySetup => {
    const raceRepository = mockRaceRepository();
    const playerRepository = mockPlayerRepository();
    const placeRepository = mockPlaceRepository();
    const calendarRepository = mockCalendarRepository();
    const pushSubscriptionRepository = mockPushSubscriptionRepository();
    const pushRequestRepository = mockPushRequestRepository();
    const webPushSendRepository = mockWebPushSendRepository();
    const uiLayoutRepository = mockUiLayoutRepository();

    container.registerInstance<IRaceRepository>(
        'RaceRepository',
        raceRepository,
    );
    container.registerInstance<IUiLayoutRepository>(
        'UiLayoutRepository',
        uiLayoutRepository,
    );
    container.registerInstance<IPlayerRepository>(
        'PlayerRepository',
        playerRepository,
    );
    container.registerInstance<IPlaceRepository>(
        'PlaceRepository',
        placeRepository,
    );
    container.registerInstance<ICalendarRepository>(
        'CalendarRepository',
        calendarRepository,
    );
    container.registerInstance<IPushSubscriptionRepository>(
        'PushSubscriptionRepository',
        pushSubscriptionRepository,
    );
    container.registerInstance<IPushRequestRepository>(
        'PushRequestRepository',
        pushRequestRepository,
    );
    container.registerInstance<IWebPushSendRepository>(
        'WebPushSendRepository',
        webPushSendRepository,
    );

    return {
        raceRepository,
        playerRepository,
        placeRepository,
        calendarRepository,
        pushSubscriptionRepository,
        pushRequestRepository,
        webPushSendRepository,
        uiLayoutRepository,
    };
};
