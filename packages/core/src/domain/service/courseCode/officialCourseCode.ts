import { RaceCourseOfficialMasterList } from '../../master/courseOfficialMaster';
import type { LocationCode } from '../../model/valueObject/locationCode';
import { validateLocationCode } from '../../model/valueObject/locationCode';
import type { RaceCourse } from '../../model/valueObject/raceCourse';
import type { RaceType } from '../../model/valueObject/raceType';

/**
 * 開催場コードが未検出であることを表すセンチネル値。
 * `findPlaceCodeByName` が対応する placeCode を見つけられなかった場合に返す。
 * 各所に直書きされていた `'00'` の意味を明示し、比較・既定値で共有する。
 */
export const UNKNOWN_PLACE_CODE: LocationCode = validateLocationCode('00');

/**
 * `raceType:raceCourse` → placeCode のルックアップ表。
 * `RaceCourseOfficialMasterList` はモジュール初期化時に確定する不変マスタのため、
 * 呼び出しのたびに配列を線形探索する代わりにモジュール初期化時へ1回だけ構築する
 * （PERF-095/PERF-103: レース行1件ごとに155件規模のマスタを都度 `.find()` していたコスト）。
 * 同一キーが複数存在する場合は `Array.find` と同じ「先勝ち」を維持するため、
 * 既に登録済みのキーは上書きしない。
 */
const placeCodeByRaceCourseAndTypeMap = new Map<string, string>();

/** `raceType:placeCode` → raceCourse のルックアップ表（用途は上記と同様）。 */
const raceCourseByPlaceCodeAndTypeMap = new Map<string, RaceCourse>();

for (const entry of RaceCourseOfficialMasterList) {
    const placeCodeKey = `${entry.raceType}:${entry.raceCourse}`;
    if (!placeCodeByRaceCourseAndTypeMap.has(placeCodeKey)) {
        placeCodeByRaceCourseAndTypeMap.set(placeCodeKey, entry.placeCode);
    }
    const raceCourseKey = `${entry.raceType}:${entry.placeCode}`;
    if (!raceCourseByPlaceCodeAndTypeMap.has(raceCourseKey)) {
        raceCourseByPlaceCodeAndTypeMap.set(raceCourseKey, entry.raceCourse);
    }
}

/**
 * 公式マスタから raceCourse + raceType に対応する placeCode を引く生ルックアップ。
 * 見つからない場合の既定値はここでは付与せず、呼び出し側（findPlaceCodeByName /
 * createPlaceCodeForOfficial）がそれぞれの既定値を適用する。
 * @param raceCourse 開催場名
 * @param raceType レース種別
 * @returns placeCode（見つからない場合は undefined）
 */
export const lookupOfficialPlaceCode = (
    raceCourse: RaceCourse,
    raceType: RaceType,
): string | undefined =>
    placeCodeByRaceCourseAndTypeMap.get(`${raceType}:${raceCourse}`);

/**
 * placeName と raceType からplaceCodeを検索
 * @param raceCourse 開催場名
 * @param raceType レース種別
 * @returns placeCode（見つからない場合は {@link UNKNOWN_PLACE_CODE}）
 */
export const findPlaceCodeByName = (
    raceCourse: RaceCourse,
    raceType: RaceType,
): LocationCode => {
    const placeCode = lookupOfficialPlaceCode(raceCourse, raceType);
    return placeCode === undefined
        ? UNKNOWN_PLACE_CODE
        : validateLocationCode(placeCode);
};

/**
 * locationCode と raceType から placeName を検索
 * locationCodeは先頭ゼロ付き(例:'03')、placeCodeは可変(例:'3'または'03')
 * @param locationCode 場所コード
 * @param raceType レース種別
 * @returns placeName（見つからない場合は null）
 */
export const findPlaceNameByCode = (
    locationCode: LocationCode,
    raceType: RaceType,
): RaceCourse | null => {
    const normalizedCode = locationCode.replace(/^0+/, '') || '0';
    const course =
        raceCourseByPlaceCodeAndTypeMap.get(`${raceType}:${locationCode}`) ??
        raceCourseByPlaceCodeAndTypeMap.get(`${raceType}:${normalizedCode}`);
    return course ?? null;
};

/**
 * 公式マスタから placeCode を引く（見つからない場合は空文字）。
 * ルックアップ本体は本ファイルの lookupOfficialPlaceCode に集約している。
 * @param raceType - レース種別
 * @param raceCourse - 開催場名
 * @returns placeCode（見つからない場合は ''）
 */
export const createPlaceCodeForOfficial = (
    raceType: RaceType,
    raceCourse: RaceCourse,
): string => lookupOfficialPlaceCode(raceCourse, raceType) ?? '';
