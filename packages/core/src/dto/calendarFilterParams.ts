import type { RaceDateTime } from '../domain/model/valueObject/raceDateTime';
import type { RaceType } from '../domain/model/valueObject/raceType';

/**
 * カレンダーフィルタパラメータ
 */
export interface CalendarFilterParams {
    startDate: RaceDateTime;
    finishDate: RaceDateTime;
    raceTypeList: RaceType[];
}
