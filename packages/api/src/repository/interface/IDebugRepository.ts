/** race / race_condition テーブルの行数。 */
export interface DatabaseTableCounts {
    raceCount: number;
    raceConditionCount: number;
}

/**
 * Debug Repository Interface
 * デバッグエンドポイント（`GET /debug/database`）専用のデータアクセス。
 */
export interface IDebugRepository {
    countRaceAndRaceCondition: () => Promise<DatabaseTableCounts>;
}
