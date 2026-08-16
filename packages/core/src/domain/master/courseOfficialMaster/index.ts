import { validateLocationCode } from '../../model/valueObject/locationCode';
import { AUTORACE_COURSE_OFFICIAL_LIST } from './autorace';
import { BOATRACE_COURSE_OFFICIAL_LIST } from './boatrace';
import { JRA_COURSE_OFFICIAL_LIST } from './jra';
import { KEIRIN_COURSE_OFFICIAL_LIST } from './keirin';
import { NAR_COURSE_OFFICIAL_LIST } from './nar';
import { OVERSEAS_COURSE_OFFICIAL_LIST } from './overseas';

/**
 * レース場マスタ
 * 競馬、競輪、オートレース、競艇、海外競馬のレース場をまとめたマスタ
 *
 * 競技種別（AUTORACE/OVERSEAS/KEIRIN/NAR/BOATRACE/JRA）ごとにファイル分割された
 * リストを元の並び順のまま結合したもの。
 */
const rawRaceCourseOfficialMasterList = [
    ...AUTORACE_COURSE_OFFICIAL_LIST,
    ...OVERSEAS_COURSE_OFFICIAL_LIST,
    ...KEIRIN_COURSE_OFFICIAL_LIST,
    ...NAR_COURSE_OFFICIAL_LIST,
    ...BOATRACE_COURSE_OFFICIAL_LIST,
    ...JRA_COURSE_OFFICIAL_LIST,
];

/**
 * placeCode を {@link LocationCode} として検証済みのレース場マスタ。
 * netkeiba マスタ（{@link RaceCourseNetkeibaMasterList}）と型付けを揃える。
 */
export const RaceCourseOfficialMasterList = rawRaceCourseOfficialMasterList.map(
    (course) => ({
        ...course,
        placeCode: validateLocationCode(course.placeCode),
    }),
);
