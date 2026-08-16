import type {
    RaceDetailUi,
    RaceDetailUiConfig,
    RaceId,
    RaceType,
} from '@race-schedule/core';

/**
 * レイアウト構成 Usecase インターフェース（race-detail-sdui-design.md 参照）。
 * `packages/admin` の編集キット画面から呼ばれるサービス間APIの裏側。
 */
export interface IUiLayoutUsecase {
    /**
     * 指定raceTypeの構成を返す。D1に保存済みの構成があればそれを、無ければ
     * コード内既定構成（{@link buildDefaultRaceDetailConfig}相当）を返す。
     * @param raceType - 対象の競技種別
     */
    getConfig: (raceType: RaceType) => Promise<RaceDetailUiConfig>;

    /**
     * 指定raceTypeの構成をD1へ保存する。
     * @param raceType - 対象の競技種別
     * @param config - 保存する構成（検証済み）
     */
    saveConfig: (
        raceType: RaceType,
        config: RaceDetailUiConfig,
    ) => Promise<void>;

    /**
     * 保存せずに、指定した構成を指定レースへ適用した解決結果を返す
     * （管理画面のプレビュー用）。
     * @param config - プレビュー対象の構成（未保存でよい）
     * @param raceId - プレビューに使うレースのID
     * @returns 解決済みのUIスキーマ。該当レースが存在しない場合は null
     */
    previewConfig: (
        config: RaceDetailUiConfig,
        raceId: RaceId,
    ) => Promise<RaceDetailUi | null>;
}
