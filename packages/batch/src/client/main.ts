/**
 * メインAPI通信モジュール
 * 開催場情報の取得を担当
 *
 * 特性：
 * - PlaceEntity（IDを含む完全なエンティティ）を返す
 */

import { type PlaceEntity, RaceType } from '@race-schedule/core';

import { getApiConfig } from '../types';
import { fetchPlaceList } from './place';

/**
 * メインAPIから開催場情報を取得
 * @param raceType レース種別（JRA/NAR/KEIRINなど）
 * @param startDate 開始日（YYYY-MM-DD形式）
 * @param finishDate 終了日（YYYY-MM-DD形式）
 * @returns 開催場エンティティのリスト
 */
export async function fetchMainPlaceList(
    raceType: RaceType,
    startDate: string,
    finishDate: string,
): Promise<PlaceEntity[]> {
    const config = getApiConfig();
    return fetchPlaceList(config.mainApiUrl, {
        startDate,
        finishDate,
        raceTypeList: raceType,
        isDisplayPlaceHeldDays: raceType === RaceType.JRA,
    });
}
