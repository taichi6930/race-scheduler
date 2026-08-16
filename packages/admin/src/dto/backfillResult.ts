import type { UpsertApiResponse } from '@race-schedule/core';

/**
 * メインAPI（@race-schedule/api）の `POST /internal/backfill/place` が返す結果。
 * api側の `BackfillPlaceResult`（`packages/api/src/usecase/interface/IBackfillUsecase.ts`）
 * と同じ形のレスポンスJSONを表す、admin側で見たDTO（パッケージ境界を越えて型を
 * 共有しないため個別に定義している。`dto/featureFlagStatus.ts`と同じ方針）。
 */
export interface BackfillPlaceResult extends UpsertApiResponse {
    notCachedKeys: string[];
}

/**
 * メインAPI（@race-schedule/api）の `POST /internal/backfill/race` が返す結果。
 * api側の `BackfillRaceResult` と同じ形。
 */
export interface BackfillRaceResult extends UpsertApiResponse {
    notCachedPlaceIds: string[];
}

/** `POST /internal/backfill/{place,race}` 共通のリクエストボディ。 */
export interface BackfillFilter {
    startDate: string;
    finishDate: string;
    raceTypeList: string[];
}
