import { RaceCourseNetkeibaMasterList } from '../../master/courseNetkeibaMaster';
import type { RaceCourse } from '../../model/valueObject/raceCourse';
import type { RaceType } from '../../model/valueObject/raceType';
import { isIncludedRaceType } from '../../model/valueObject/raceType';

/**
 * RaceCourseMasterListからraceTypeごとのPlaceCodeMapを生成するユーティリティ
 * レース場名とコードの対応表
 * @param raceType - レース種別
 * @returns placeName をキー、placeCode を値とするマップ
 */
const createPlaceCodeMapForNetkeiba = (
    raceType: RaceType,
): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const course of RaceCourseNetkeibaMasterList) {
        if (isIncludedRaceType(course.raceType, [raceType])) {
            map[course.raceCourse] = course.placeCode;
        }
    }
    return map;
};

export const createPlaceCodeForNetkeiba = (
    raceType: RaceType,
    raceCourse: RaceCourse,
): string => {
    const placeCodeMap = createPlaceCodeMapForNetkeiba(raceType);
    return placeCodeMap[raceCourse] ?? '';
};
