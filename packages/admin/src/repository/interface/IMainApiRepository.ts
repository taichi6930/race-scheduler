import type {
    RaceDetailUi,
    RaceDetailUiConfig,
    RaceType,
    ReleaseNote,
} from '@race-schedule/core';

import type {
    BackfillFilter,
    BackfillPlaceResult,
    BackfillRaceResult,
} from '../../dto/backfillResult';
import type { FeatureFlagStatus } from '../../dto/featureFlagStatus';
import type { RaceSummary } from '../../dto/raceSummary';

/**
 * メインAPI（@race-schedule/api）の機能フラグ・バックフィル・レイアウト構成を
 * やり取りするリポジトリのインターフェース定義
 * @remarks
 * MainApiGateway（HTTP通信の詳細）をラップし、Usecase から見た
 * 「機能フラグの取得・更新」「バックフィルの実行」「レイアウト構成の取得・保存・
 * プレビュー」というドメイン操作を提供する。
 * Usecase は Gateway を直接触らず、この Repository 経由でデータへアクセスする
 * （controller → usecase → repository → gateway の層順序を守るため）。
 */
export interface IMainApiRepository {
    /** 登録済み機能フラグの状態一覧を取得する。 */
    fetchFeatureFlagList: () => Promise<FeatureFlagStatus[]>;

    /**
     * 指定した機能フラグの値を更新する。
     * @param key - 更新対象のフラグキー
     * @param enabled - 更新後の値
     * @returns 更新後のフラグ状態一覧
     */
    updateFeatureFlag: (
        key: string,
        enabled: boolean,
    ) => Promise<FeatureFlagStatus[]>;

    /** 指定期間・レース種別の開催場情報をキャッシュのみで再同期する。 */
    backfillPlace: (filter: BackfillFilter) => Promise<BackfillPlaceResult>;

    /** 指定期間・レース種別のレース情報をキャッシュのみで再同期する。 */
    backfillRace: (filter: BackfillFilter) => Promise<BackfillRaceResult>;

    /** 指定raceTypeのレース詳細レイアウト構成（保存済み、無ければ既定値）を取得する。 */
    fetchUiLayout: (raceType: RaceType) => Promise<RaceDetailUiConfig>;

    /**
     * 指定raceTypeのレース詳細レイアウト構成を保存する。
     * @param raceType - 保存対象のレース種別
     * @param config - 保存する構成
     * @returns 保存した構成
     */
    saveUiLayout: (
        raceType: RaceType,
        config: RaceDetailUiConfig,
    ) => Promise<RaceDetailUiConfig>;

    /**
     * 保存せずに、指定した構成を指定レースへ適用した解決結果を取得する。
     * @param config - プレビュー対象の構成
     * @param raceId - プレビューに使うレースID
     * @returns 解決済みのUIスキーマ。該当レースが無ければ `undefined`
     */
    previewUiLayout: (
        config: RaceDetailUiConfig,
        raceId: string,
    ) => Promise<RaceDetailUi | undefined>;

    /**
     * プレビュー候補として、今日から指定日数以内に開催されるKEIRINレースの
     * 一覧を取得する。
     * @param days - 今日から何日先まで含めるか
     * @returns レース要約の一覧
     */
    fetchUpcomingKeirinRaces: (days: number) => Promise<RaceSummary[]>;

    /** 分割元の非公開リポジトリ（race-schedule）分も含む、全リリースノートを取得する。 */
    fetchReleaseNotes: () => Promise<ReleaseNote[]>;
}
