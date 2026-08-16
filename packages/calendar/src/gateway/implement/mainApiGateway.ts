import type { CalendarFlagEntity, RaceEntity } from '@race-schedule/core';
import {
    fetchWithTimeout,
    toJstISOString,
    validateCalendarFlagEntity,
    validateRaceEntity,
    withServiceAuthHeader,
} from '@race-schedule/core';
import { injectable } from 'tsyringe';

import { getMainApiUrl } from '../../utility/mainApiConfig';
import type {
    IMainApiGateway,
    MainApiRaceFilter,
} from '../interface/IMainApiGateway';

/** メインAPI /race のレスポンス（datetime は JST ISO 文字列） */
interface RaceListResponse {
    races: (Omit<RaceEntity, 'datetime'> & { datetime: string })[];
}

/** メインAPI /calendar/flag のレスポンス */
interface CalendarFlagListResponse {
    flags: unknown[];
}

@injectable()
export class MainApiGateway implements IMainApiGateway {
    public async fetchRaceList(
        filter: MainApiRaceFilter,
    ): Promise<RaceEntity[]> {
        const url = new URL('/race', getMainApiUrl());
        url.searchParams.set('startDate', toJstISOString(filter.startDate));
        url.searchParams.set('finishDate', toJstISOString(filter.finishDate));
        url.searchParams.set('raceTypeList', filter.raceTypeList.join(','));

        const response = await fetchWithTimeout<RaceListResponse>(url, {
            headers: withServiceAuthHeader(),
        });
        return response.races.map((dto) =>
            validateRaceEntity({
                ...dto,
                datetime: new Date(dto.datetime),
            }),
        );
    }

    public async fetchCalendarFlagList(): Promise<CalendarFlagEntity[]> {
        const url = new URL('/calendar/flag', getMainApiUrl());
        const response = await fetchWithTimeout<CalendarFlagListResponse>(url, {
            headers: withServiceAuthHeader(),
        });
        return response.flags.map((flag) => validateCalendarFlagEntity(flag));
    }
}
