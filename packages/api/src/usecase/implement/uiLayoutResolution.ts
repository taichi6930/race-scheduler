import type { RaceDetailUiConfig, RaceType } from '@race-schedule/core';
import { buildDefaultRaceDetailConfig } from '@race-schedule/core';

import type { IUiLayoutRepository } from '../../repository/interface/IUiLayoutRepository';

/**
 * `race_detail.<raceType>` 形式のD1キーを組み立てる
 * （race-detail-sdui-design.md §1.3・§1.7）。
 * @param raceType - 対象の競技種別
 */
export const layoutKeyFor = (raceType: RaceType): string =>
    `race_detail.${raceType}`;

/**
 * D1（ui_layout テーブル）に保存済みの構成があればそれを、無ければコード内
 * 既定構成を返す。`RaceUsecase.fetchRaceDetailUi`（front向け読み取り）と
 * `UiLayoutUsecase.getConfig`（admin向け読み取り）の両方から使う共通の
 * 解決順序（race-detail-sdui-design.md §1.3）。
 * @param uiLayoutRepository - レイアウト構成リポジトリ
 * @param raceType - 対象の競技種別
 */
export const resolveStoredOrDefaultConfig = async (
    uiLayoutRepository: IUiLayoutRepository,
    raceType: RaceType,
): Promise<RaceDetailUiConfig> => {
    const stored = await uiLayoutRepository.get(layoutKeyFor(raceType));
    return stored ?? buildDefaultRaceDetailConfig(raceType);
};
