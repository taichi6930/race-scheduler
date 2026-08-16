export interface FailureDetail {
    db: string; // table or DB identifier
    id: string;
    reason: string;
}

export interface UpsertResult {
    successCount: number;
    failureCount: number;
    failures: FailureDetail[];
}

/**
 * 空の UpsertResult を生成するファクトリ関数
 *
 * すべてのリポジトリ実装で一貫性を保つため、
 * UpsertResult の初期化時はこの関数を使用してください。
 * @returns successCount: 0, failureCount: 0, failures: [] の初期状態
 * @example
 * const result = createEmptyUpsertResult();
 * // { successCount: 0, failureCount: 0, failures: [] }
 */
export function createEmptyUpsertResult(): UpsertResult {
    return {
        successCount: 0,
        failureCount: 0,
        failures: [],
    };
}
