import { RaceCourseNetkeibaMasterList } from '../../master/courseNetkeibaMaster';
import type { RaceCourse } from '../../model/valueObject/raceCourse';
import type { RaceType } from '../../model/valueObject/raceType';
import { isIncludedRaceType } from '../../model/valueObject/raceType';

/**
 * 開催場名 → netkeibaの開催場コード の対応表。
 * 開催場名は実行時に決まる文字列（`RaceCourse`）で引かれるため、
 * キーを固定できない索引型として定義する。
 */
interface NetkeibaPlaceCodeMap {
    [raceCourse: string]: string;
}

/**
 * RaceCourseMasterListからraceTypeごとのPlaceCodeMapを生成するユーティリティ
 * レース場名とコードの対応表
 * @param raceType - レース種別
 * @returns placeName をキー、placeCode を値とするマップ
 */
const createPlaceCodeMapForNetkeiba = (
    raceType: RaceType,
): NetkeibaPlaceCodeMap => {
    const map: NetkeibaPlaceCodeMap = {};
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
