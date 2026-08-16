import type { RaceType } from '../../model/valueObject/raceType';

/** レース場マスタ（バリデーション前）1件分のエントリ型。 */
export interface RawCourseOfficialEntry {
    raceType: RaceType;
    raceCourse: string;
    placeCode: string;
}
