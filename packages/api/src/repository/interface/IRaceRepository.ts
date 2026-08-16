import type {
    RaceEntity,
    RaceId,
    RacePlayerEntity,
    SearchRaceFilterParamsInput,
    UpsertResult,
} from '@race-schedule/core';

/**
 * レース情報取得リポジトリのインターフェース
 */
export interface IRaceRepository {
    /**
     * レース情報のEntity配列を取得する
     * @param searchRaceFilterParams - レース情報フィルター情報
     */
    fetch: (
        searchRaceFilterParams: SearchRaceFilterParamsInput,
    ) => Promise<RaceEntity[]>;

    /**
     * レース情報Entity配列をupsertする
     * @param entityList - upsert対象のEntity配列
     */
    upsert: (entityList: RaceEntity[]) => Promise<UpsertResult>;

    /**
     * raceIdを指定して単一のレース情報を取得する
     * @param raceId - 取得対象のraceId（domain検証済みのRaceId型）
     * @returns 該当レースのEntity。存在しない場合は null
     */
    fetchByRaceId: (raceId: RaceId) => Promise<RaceEntity | null>;

    /**
     * 指定した raceId のうち、注目選手（player_watch, priority>0）が
     * 出走しているものの集合を取得する
     * @remarks
     * SPEC-PLAYER-001。calendarRepository.fetchFlaggedRaceIds と同じ
     * 「呼び出し側が既に絞り込んだ raceId 集合に対する IN 句クエリ」パターン。
     * @param raceIds - 絞り込み対象の raceId 一覧（空配列の場合はDBへ問い合わせず空のSetを返す）
     * @returns 指定raceIdのうち注目選手が出走しているものの集合
     */
    fetchWatchedRaceIds: (raceIds: readonly string[]) => Promise<Set<string>>;

    /**
     * raceIdを指定して、そのレースの出走選手一覧（race_playerのスナップショット）を
     * 車番昇順で取得する
     * @param raceId - 取得対象のraceId
     * @returns 出走選手一覧。race_playerに行が無い場合（機械式以外・未取得）は空配列
     */
    fetchRacePlayers: (raceId: RaceId) => Promise<RacePlayerEntity[]>;
}
