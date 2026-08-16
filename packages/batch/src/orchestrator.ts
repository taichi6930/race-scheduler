/**
 * バッチ処理のメインロジック
 * 指定されたバッチ対象（place/race/calendar）を順序実行
 * 各バッチの成功/失敗状況をオブジェクトで返す
 */

import { appLogger, createErrorMessage } from '@race-schedule/core';

import { runCalendarBatch } from './batch/calendar';
import { runPlaceBatch } from './batch/place';
import { runRaceBatch } from './batch/race';
import type { BatchConfig, BatchExecTarget, BatchTarget } from './types';

/**
 * バッチ処理の失敗詳細（対象 ID と失敗理由）
 */
export interface BatchFailure {
    /** 失敗した対象の識別子 */
    id: string;
    /** 失敗理由 */
    reason: string;
}

/**
 * バッチ処理の実行結果
 * 成功/失敗のカウント、詳細な失敗情報、実行時間を含む
 */
export interface BatchResult {
    /** 処理対象（place/race/calendar） */
    target: BatchTarget;
    /** 正常に処理された件数 */
    successCount: number;
    /** 処理に失敗した件数 */
    failureCount: number;
    /** 失敗の詳細情報（ID、失敗理由） */
    failures: BatchFailure[];
    /** 実行時間（ミリ秒） */
    duration: number;
}

/**
 * target に応じたバッチ処理を1つ実行する。
 * @param target バッチ対象（place/race/calendarを１つ指定）
 * @param config バッチ実行設定
 * @returns 成功件数
 */
async function runBatchByTarget(
    target: BatchExecTarget,
    config: BatchConfig,
): Promise<number> {
    switch (target) {
        case 'place': {
            return runPlaceBatch(config);
        }
        case 'race': {
            return runRaceBatch(config);
        }
        case 'calendar': {
            return runCalendarBatch(config);
        }
    }
}

/**
 * 1つのバッチ処理を実行
 * @param target バッチ対象（place/race/calendarを１つ指定）
 * @param config バッチ実行設定
 * @returns バッチ実行結果。エラー時も例外を投げずに失敗情報として返す
 */
export async function executeBatch(
    target: BatchExecTarget,
    config: BatchConfig,
): Promise<BatchResult> {
    const startTime = Date.now();
    const failures: BatchFailure[] = [];
    let successCount = 0;

    try {
        successCount = await runBatchByTarget(target, config);
    } catch (error) {
        appLogger.error(`${target} batch failed:`, error);
        failures.push({
            id: target,
            reason: createErrorMessage('main', error),
        });
    }

    return {
        target,
        successCount,
        failureCount: failures.length,
        failures,
        duration: Date.now() - startTime,
    };
}

/**
 * 複数のバッチ処理を順序実行
 * place → race → calendar の順番で実行（--all を指定した場合）
 * @param targets 実行するバッチ対象の配列
 * @param config バッチ実行設定
 * @returns 各バッチの実行結果を配列で返す
 */
export async function executeMultipleBatches(
    targets: BatchExecTarget[],
    config: BatchConfig,
): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const target of targets) {
        appLogger.info(`\nExecuting ${target} batch...`);
        const result = await executeBatch(target, config);
        results.push(result);
        appLogger.info(
            `${target.toUpperCase()} Batch Result: success=${result.successCount}, failure=${result.failureCount}, duration=${result.duration}ms`,
        );
    }

    return results;
}
