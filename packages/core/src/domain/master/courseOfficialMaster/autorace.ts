import { RaceType } from '../../model/valueObject/raceType';
import type { RawCourseOfficialEntry } from './types';

/** AUTORACE のレース場マスタ（詳細は courseOfficialMaster/index.ts のJSDoc参照）。 */
export const AUTORACE_COURSE_OFFICIAL_LIST: RawCourseOfficialEntry[] = [
    {
        raceType: RaceType.AUTORACE,
        raceCourse: '船橋',
        placeCode: '01',
    },
    {
        raceType: RaceType.AUTORACE,
        raceCourse: '川口',
        placeCode: '02',
    },
    {
        raceType: RaceType.AUTORACE,
        raceCourse: '伊勢崎',
        placeCode: '03',
    },
    {
        raceType: RaceType.AUTORACE,
        raceCourse: '浜松',
        placeCode: '04',
    },
    {
        raceType: RaceType.AUTORACE,
        raceCourse: '飯塚',
        placeCode: '05',
    },
    {
        raceType: RaceType.AUTORACE,
        raceCourse: '山陽',
        placeCode: '06',
    },
];
