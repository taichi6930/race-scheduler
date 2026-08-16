/**
 * カレンダー登録・更新結果
 *
 * `successCount`（`insertedCount + updatedCount + deletedCount`）は
 * place/race/player の `UpsertResult` と共通の集計フィールドとして持たせている。
 * カレンダー固有の内訳（登録/更新/削除の別）は既存どおり個別フィールドで保持する。
 */
export interface CalendarUpsertResult {
    successCount: number;
    insertedCount: number;
    updatedCount: number;
    deletedCount: number;
    failureCount: number;
    failures: {
        id: string;
        reason: string;
    }[];
}

/**
 * 空の CalendarUpsertResult を生成する。
 * api の googleCalendarRepository で複数箇所に重複していたリテラルを集約する。
 */
export const createEmptyCalendarUpsertResult = (): CalendarUpsertResult => ({
    successCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    failureCount: 0,
    failures: [],
});
