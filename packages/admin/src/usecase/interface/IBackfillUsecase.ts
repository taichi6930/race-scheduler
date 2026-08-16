import type {
    BackfillFilter,
    BackfillPlaceResult,
    BackfillRaceResult,
} from '../../dto/backfillResult';

/**
 * バックフィル（R2キャッシュのみでの再同期）Usecase インターフェース。
 * 実際の処理（対象placeIdの解決・再パース・再Upsert）はメインAPI
 * （@race-schedule/api の `/internal/backfill/{place,race}`）が行うため、
 * ここではリクエストをそのまま委譲する（admin-package-design.md 参照）。
 */
export interface IBackfillUsecase {
    /** 指定期間・レース種別の開催場情報をキャッシュのみで再同期する。 */
    backfillPlace: (filter: BackfillFilter) => Promise<BackfillPlaceResult>;

    /** 指定期間・レース種別のレース情報をキャッシュのみで再同期する。 */
    backfillRace: (filter: BackfillFilter) => Promise<BackfillRaceResult>;
}
