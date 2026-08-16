import { RaceType } from '../../model/valueObject/raceType';
import type { RawCourseOfficialEntry } from './types';

/** JRA のレース場マスタ（詳細は courseOfficialMaster/index.ts のJSDoc参照）。 */
export const JRA_COURSE_OFFICIAL_LIST: RawCourseOfficialEntry[] = [
    {
        raceType: RaceType.JRA,
        raceCourse: '札幌',
        placeCode: '01',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '函館',
        placeCode: '02',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '福島',
        placeCode: '03',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '新潟',
        placeCode: '04',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '東京',
        placeCode: '05',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '中山',
        placeCode: '06',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '中京',
        placeCode: '07',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '京都',
        placeCode: '08',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '阪神',
        placeCode: '09',
    },
    {
        raceType: RaceType.JRA,
        raceCourse: '小倉',
        placeCode: '10',
    },
];
