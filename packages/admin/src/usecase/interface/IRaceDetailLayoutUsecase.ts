import type {
    RaceDetailUi,
    RaceDetailUiConfig,
    RaceType,
} from '@race-schedule/core';

import type { RaceSummary } from '../../dto/raceSummary';

/**
 * レース詳細レイアウト編集キット Usecase インターフェース
 * （race-detail-sdui-design.md §1.4）。
 */
export interface IRaceDetailLayoutUsecase {
    /** 指定raceTypeの構成（保存済み、無ければ既定値）を返す。 */
    getConfig: (raceType: RaceType) => Promise<RaceDetailUiConfig>;

    /**
     * 指定raceTypeの構成を保存する。
     * @param raceType - 保存対象のレース種別
     * @param config - 保存する構成
     * @returns 保存した構成
     */
    saveConfig: (
        raceType: RaceType,
        config: RaceDetailUiConfig,
    ) => Promise<RaceDetailUiConfig>;

    /**
     * 保存せずに、指定した構成を指定レースへ適用した解決結果を返す。
     * @param config - プレビュー対象の構成
     * @param raceId - プレビューに使うレースID
     * @returns 解決済みのUIスキーマ。該当レースが無ければ `undefined`
     */
    previewConfig: (
        config: RaceDetailUiConfig,
        raceId: string,
    ) => Promise<RaceDetailUi | undefined>;

    /**
     * プレビュー候補として、今日から指定日数以内に開催されるKEIRINレースの
     * 一覧を返す。
     * @param days - 今日から何日先まで含めるか
     * @returns レース要約の一覧
     */
    listPreviewCandidates: (days: number) => Promise<RaceSummary[]>;
}
