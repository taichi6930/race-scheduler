import { makeRaceTypeScopedStringSchema } from '../../../utilities/makeRaceTypeScopedStringSchema';
import { RaceCourseOfficialMasterList } from '../../master/courseOfficialMaster';
import type { RaceType } from './raceType';
import { isIncludedRaceType } from './raceType';

/**
 * RaceCourseの型定義
 */
export type RaceCourse = string;

/**
 * 開催場リスト
 * @param raceType - レース種別
 */
const RaceCourseList = (raceType: RaceType): Set<string> => {
    const courseList = RaceCourseOfficialMasterList.filter((course) =>
        isIncludedRaceType(course.raceType, [raceType]),
    );
    const placeNames = new Set<string>(
        courseList.map((course): string => course.raceCourse),
    );
    return placeNames;
};

/**
 * RaceCourseのzod型定義
 * @param raceType - レース種別
 */
export const RaceCourseSchema = makeRaceTypeScopedStringSchema(
    RaceCourseList,
    (raceType) => `${raceType}の開催場ではありません`,
);
