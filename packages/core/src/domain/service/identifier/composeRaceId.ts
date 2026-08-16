import { ID_PAD_CHAR, ID_SEGMENT_PAD_WIDTH } from '../../../constants/idFormat';
import type { LocationCode } from '../../model/valueObject/locationCode';
import type { RaceDateTime } from '../../model/valueObject/raceDateTime';
import { type RaceId, validateRaceId } from '../../model/valueObject/raceId';
import type { RaceNumber } from '../../model/valueObject/raceNumber';
import type { RaceType } from '../../model/valueObject/raceType';
import { composePlaceId } from './composePlaceId';

/**
 * レースIDを生成
 *
 * レースIDは開催場ID（{@link composePlaceId}）の末尾にレース番号を付加したもの。
 * placeId 部分の組み立て（JST 日付・ゼロ埋め開催場コード）は composePlaceId に委譲し重複を排除する。
 * @param raceType レース種別
 * @param dateTime 開催日時（RaceDateTimeオブジェクト）
 * @param locationCode 開催場コード
 * @param raceNumber レース番号
 * @returns レースID（RaceType + YYYYMMDD + location_code + race_number）
 */
export const composeRaceId = (
    raceType: RaceType,
    dateTime: RaceDateTime,
    locationCode: LocationCode,
    raceNumber: RaceNumber,
): RaceId => {
    const paddedRaceNumber = String(raceNumber).padStart(
        ID_SEGMENT_PAD_WIDTH,
        ID_PAD_CHAR,
    );
    return validateRaceId(
        `${composePlaceId(raceType, dateTime, locationCode)}${paddedRaceNumber}`,
    );
};
