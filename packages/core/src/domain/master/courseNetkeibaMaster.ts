import type { Course } from '../model/valueObject/course';
import { validateLocationCode } from '../model/valueObject/locationCode';
import { RaceType } from '../model/valueObject/raceType';

/**
 * netkeiba.comのコースコードを元にしたコースのマスターデータ
 */

const rawRaceCourseNetkeibaMasterList: {
    raceType: RaceType;
    raceCourse: string;
    placeCode: string;
}[] = [
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
    {
        raceType: RaceType.NAR,
        raceCourse: '北見ば',
        placeCode: '63',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '岩見ば',
        placeCode: '64',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '帯広ば',
        placeCode: '65',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '旭川ば',
        placeCode: '66',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '門別',
        placeCode: '30',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '旭川',
        placeCode: '34',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '盛岡',
        placeCode: '35',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '水沢',
        placeCode: '36',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '上山',
        placeCode: '37',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '三条',
        placeCode: '38',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '足利',
        placeCode: '39',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '宇都宮',
        placeCode: '40',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '高崎',
        placeCode: '41',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '浦和',
        placeCode: '42',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '船橋',
        placeCode: '43',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '大井',
        placeCode: '44',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '川崎',
        placeCode: '45',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '金沢',
        placeCode: '46',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '笠松',
        placeCode: '47',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '名古屋',
        placeCode: '48',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '園田',
        placeCode: '50',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '姫路',
        placeCode: '51',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '益田',
        placeCode: '52',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '福山',
        placeCode: '53',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '高知',
        placeCode: '54',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '佐賀',
        placeCode: '55',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '荒尾',
        placeCode: '56',
    },
    {
        raceType: RaceType.NAR,
        raceCourse: '中津',
        placeCode: '57',
    },
];

export const RaceCourseNetkeibaMasterList: Course[] =
    rawRaceCourseNetkeibaMasterList.map((course) => ({
        ...course,
        placeCode: validateLocationCode(course.placeCode),
    }));
