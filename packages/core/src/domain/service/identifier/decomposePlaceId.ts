import {
    DATE_DAY_LENGTH,
    DATE_MONTH_LENGTH,
    DATE_STRING_LENGTH,
    DATE_YEAR_LENGTH,
    ID_SEGMENT_PAD_WIDTH,
} from '../../../constants/idFormat';
import {
    type LocationCode,
    validateLocationCode,
} from '../../model/valueObject/locationCode';
import type { PlaceId } from '../../model/valueObject/placeId';
import type { RaceDateTime } from '../../model/valueObject/raceDateTime';
import type { RaceType } from '../../model/valueObject/raceType';
import { validateRaceType } from '../../model/valueObject/raceType';

/** 開催場所コードの桁数（ID セグメントのゼロ埋め桁数と同一） */
const PLACE_ID_LOCATION_CODE_LENGTH = ID_SEGMENT_PAD_WIDTH;
/** 日付（YYYYMMDD）＋開催場所コードの合計桁数 */
const PLACE_ID_DATE_AND_LOCATION_LENGTH =
    DATE_STRING_LENGTH + PLACE_ID_LOCATION_CODE_LENGTH;

/** decomposePlaceId が返す RaceType・開催日・開催場所コード。 */
interface DecomposedPlaceId {
    raceType: RaceType;
    date: RaceDateTime;
    locationCode: LocationCode;
}

/**
 * 日付文字列（YYYYMMDD）を Date に変換する。
 * @param dateString - YYYYMMDD 形式の日付文字列
 */
const parseDateSegment = (dateString: string): RaceDateTime => {
    const yearEndIndex = DATE_YEAR_LENGTH;
    const monthEndIndex = DATE_YEAR_LENGTH + DATE_MONTH_LENGTH;
    const dayEndIndex = DATE_YEAR_LENGTH + DATE_MONTH_LENGTH + DATE_DAY_LENGTH;

    return new Date(
        Number(dateString.slice(0, yearEndIndex)),
        Number(dateString.slice(yearEndIndex, monthEndIndex)) - 1,
        Number(dateString.slice(monthEndIndex, dayEndIndex)),
    );
};

/**
 * placeIdからRaceType・開催日・開催場所コードを取得する関数
 * @param placeId - placeId
 * @returns - RaceType・開催日・開催場所コード
 */
export const decomposePlaceId = (placeId: PlaceId): DecomposedPlaceId => {
    // raceTypeはplaceIdから末尾の日付＋開催場所コードを除いた部分として取得（小文字で格納されている）
    const raceType = validateRaceType(
        placeId.slice(0, -PLACE_ID_DATE_AND_LOCATION_LENGTH),
    );
    // dateは開催場所コードを除いた末尾の日付文字列（YYYYMMDD）として取得
    const dateString = placeId.slice(
        -PLACE_ID_DATE_AND_LOCATION_LENGTH,
        -PLACE_ID_LOCATION_CODE_LENGTH,
    );
    const date = parseDateSegment(dateString);
    // 末尾の開催場所コードを取得
    const locationCode = validateLocationCode(
        placeId.slice(-PLACE_ID_LOCATION_CODE_LENGTH),
    );
    return { raceType, date, locationCode };
};
