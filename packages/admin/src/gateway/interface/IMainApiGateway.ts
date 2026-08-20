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
import type { InviteIssueResult } from '../../dto/invite';
import type { ParticipantSummary } from '../../dto/participant';
import type { RaceSummary } from '../../dto/raceSummary';

/**
 * メインAPI（@race-schedule/api）の機能フラグ管理エンドポイント
 * （`/internal/feature-flags`）・バックフィルエンドポイント
 * （`/internal/backfill/{place,race}`）・レイアウト構成エンドポイント
 * （`/internal/ui-layout*`）・招待発行・参加者一覧エンドポイント
 * （`/auth/invite`・`/auth/participants`）と通信するゲートウェイ
 */
export interface IMainApiGateway {
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
     * @returns レース要約の一覧（開催日時の昇順は保証しない。呼び出し側でソートする）
     */
    fetchUpcomingKeirinRaces: (days: number) => Promise<RaceSummary[]>;

    /**
     * 分割元の非公開リポジトリ（race-schedule）分も含む、全リリースノートを
     * 公開日時の新しい順で取得する。frontの更新履歴画面（`GET /release-notes`）は
     * 公開リポジトリ（race-scheduler）分のみを返すため、非公開分はこの管理画面
     * 専用エンドポイント（`/internal/release-notes`）経由でのみ参照できる。
     */
    fetchReleaseNotes: () => Promise<ReleaseNote[]>;

    /**
     * 招待を新規発行する。
     * @param memo - 運用者専用の管理メモ（本人には見せない）。無ければnull
     * @returns 発行された招待トークン
     */
    issueInvite: (memo: string | null) => Promise<InviteIssueResult>;

    /** 招待から登録済みの全参加者（クレデンシャル単位）の一覧を取得する。 */
    fetchParticipants: () => Promise<ParticipantSummary[]>;
}
