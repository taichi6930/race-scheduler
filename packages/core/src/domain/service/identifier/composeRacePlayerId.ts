import { ID_PAD_CHAR, ID_SEGMENT_PAD_WIDTH } from '../../../constants/idFormat';
import type { RaceId } from '../../model/valueObject/raceId';
import {
    type RacePlayerId,
    validateRacePlayerId,
} from '../../model/valueObject/racePlayerId';

/**
 * レース選手ID（racePlayerId）を生成
 *
 * racePlayerId は raceId（{@link composeRaceId}）の末尾に車番を付加したもの。
 * 枠番ではなく車番を使う理由: 枠番は複数車が同一枠を共有しうる（出走表HTMLの
 * rowspanで表現される）ため一意性が保証されず、主キーの合成には使えない。
 * 車番はレース内で必ず一意なので、合成キーとして安全に使える。
 * @param raceId レースID
 * @param carNumber 車番（1〜9）
 * @returns レース選手ID（raceId + car_number）
 */
export const composeRacePlayerId = (
    raceId: RaceId,
    carNumber: number,
): RacePlayerId => {
    const paddedCarNumber = String(carNumber).padStart(
        ID_SEGMENT_PAD_WIDTH,
        ID_PAD_CHAR,
    );
    return validateRacePlayerId(`${raceId}${paddedCarNumber}`);
};
