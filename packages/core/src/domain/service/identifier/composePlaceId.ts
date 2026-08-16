import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

import { ID_PAD_CHAR, ID_SEGMENT_PAD_WIDTH } from '../../../constants/idFormat';
import type { LocationCode } from '../../model/valueObject/locationCode';
import { type PlaceId, validatePlaceId } from '../../model/valueObject/placeId';
import type { RaceDateTime } from '../../model/valueObject/raceDateTime';
import type { RaceType } from '../../model/valueObject/raceType';

/**
 * 開催場IDを生成
 * @param raceType レース種別
 * @param dateTime 開催日時（YYYY-MM-DD HH:MM:SS または ISO 8601形式）
 * @param locationCode 開催場コード
 * @returns 開催場ID（RaceType + yyyyMMdd + location_code）
 */
export const composePlaceId = (
    raceType: RaceType,
    dateTime: RaceDateTime,
    locationCode: LocationCode,
): PlaceId => {
    // 日本標準時（JST/Asia/Tokyo）での日付を抽出
    const jstDateTime = toZonedTime(dateTime, 'Asia/Tokyo');
    const yyyyMMdd = format(jstDateTime, 'yyyyMMdd');
    const paddedLocationCode = locationCode.padStart(
        ID_SEGMENT_PAD_WIDTH,
        ID_PAD_CHAR,
    );
    return validatePlaceId(`${raceType}${yyyyMMdd}${paddedLocationCode}`);
};
