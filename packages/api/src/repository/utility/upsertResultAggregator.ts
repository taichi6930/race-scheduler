import type { UpsertResult } from '@race-schedule/core';
import { createErrorMessage } from '@race-schedule/core';

/**
 * `processInChunks` の成功/失敗コールバックで race/place repository に共通する
 * `UpsertResult` 集計ロジックをまとめたモジュール。
 */

/**
 * チャンク処理成功時、成功件数を result に加算する。
 * @param result - 集計結果（ミューテートして返す）
 * @param chunk - 成功したチャンク
 */
export const recordUpsertChunkSuccess = <T>(
    result: UpsertResult,
    chunk: T[],
): void => {
    result.successCount += chunk.length;
};

/** recordUpsertChunkFailure に渡すオプション。 */
export interface UpsertChunkFailureOptions<T> {
    /** FailureDetail.db に設定するテーブル/DB識別子 */
    db: string;
    /** createErrorMessage の呼び出し元識別子（例: 'RaceRepository'） */
    source: string;
    /** チャンク内の1エンティティから FailureDetail.id を取り出す */
    idOf: (entity: T) => string;
    /** チャンク内の1エンティティごとに追加で行いたい副作用（省略可） */
    onEachFailure?: (entity: T) => void;
}

/**
 * チャンク処理失敗時、チャンク内の全件を失敗として result に記録する。
 * @param result - 集計結果（ミューテートして返す）
 * @param chunk - 失敗したチャンク
 * @param error - 発生したエラー
 * @param options - db/source/idOf/onEachFailure
 */
export const recordUpsertChunkFailure = <T>(
    result: UpsertResult,
    chunk: T[],
    error: unknown,
    options: UpsertChunkFailureOptions<T>,
): void => {
    result.failureCount += chunk.length;
    for (const entity of chunk) {
        result.failures.push({
            db: options.db,
            id: options.idOf(entity),
            reason: createErrorMessage(options.source, error),
        });
        options.onEachFailure?.(entity);
    }
};
