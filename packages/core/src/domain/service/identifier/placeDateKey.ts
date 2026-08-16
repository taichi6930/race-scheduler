import { ID_SEGMENT_PAD_WIDTH } from '../../../constants/idFormat';
import type { RaceId } from '../../model/valueObject/raceId';

/**
 * raceId から「開催場・日付」を一意に表すキーを導出する。
 * raceId は raceType+yyyymmdd(8桁)+location_code(2桁)+race_number(2桁) の形式
 * （{@link RaceIdSchema}）のため、末尾のレース番号(2桁)を除いた部分が
 * 同一開催場・同一日付の全レースに共通するキーとなる（各所に直書きされていた
 * `raceId.slice(0, -2)` の意味を明示し、単一の所在に集約する）。
 * @param raceId - raceId
 * @returns 同一開催（開催場・日付）であれば同じ値になるキー文字列
 */
export const derivePlaceDateKey = (raceId: RaceId): string =>
    raceId.slice(0, -ID_SEGMENT_PAD_WIDTH);
