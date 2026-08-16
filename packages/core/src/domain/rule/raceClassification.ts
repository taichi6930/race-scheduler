import { RaceType } from '../model/valueObject/raceType';

/**
 * 機械式レースタイプ（keirin, autorace, boatrace）
 */
const MECHANICAL_RACE_TYPES = new Set<string>([
    RaceType.KEIRIN,
    RaceType.AUTORACE,
    RaceType.BOATRACE,
]);

/**
 * 競馬レースタイプ（race_condition テーブルを使うもの）
 */
const HORSE_RACE_TYPES = new Set<string>([
    RaceType.JRA,
    RaceType.NAR,
    RaceType.OVERSEAS,
]);

/**
 * 機械式レース（KEIRIN/AUTORACE/BOATRACE）かどうかを判定
 * @param raceType - 判定対象のレース種別
 * @returns 機械式レースの場合は true
 */
export const isMechanicalRace = (raceType: RaceType): boolean =>
    MECHANICAL_RACE_TYPES.has(raceType);

/**
 * 競馬系レース（JRA/NAR/OVERSEAS）かどうかを判定
 * @param raceType - 判定対象のレース種別
 * @returns 競馬系レースの場合は true
 */
export const isHorseRace = (raceType: RaceType): boolean =>
    HORSE_RACE_TYPES.has(raceType);
