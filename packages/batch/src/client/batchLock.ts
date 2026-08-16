/**
 * batch実行の排他制御ロック（api Worker `/internal/batch-lock/*`）通信モジュール
 * （CICD-73/CONC-03）。
 *
 * ロック取得の409（他インスタンスが実行中）は正常系の一結果であり例外ではないため、
 * リトライ・スキーマ検証つきの汎用 `fetchWithTimeout`（非2xxを例外にする設計）は
 * 使わず、本ファイルで直接fetchしてステータスコードを判定する。
 */
import {
    withRequestIdHeader,
    withServiceAuthHeader,
} from '@race-schedule/core';
import { z } from 'zod';

import { getApiConfig } from '../types';

/** ロック系エンドポイントは軽量なDB更新のみのため、短いタイムアウトで十分。 */
const BATCH_LOCK_TIMEOUT_MS = 10_000;

const BatchLockAcquireResponseSchema = z.object({ acquired: z.boolean() });

/** ロック取得結果。 */
export interface BatchLockAcquireResult {
    acquired: boolean;
}

/**
 * batch実行ロックの取得を試みる。
 * @param instanceId 取得するWorkflowインスタンスID
 * @returns 取得できたかどうか
 * @throws {Error} 409以外の非2xxレスポンス、またはネットワークエラーの場合
 */
export async function acquireBatchLock(
    instanceId: string,
): Promise<BatchLockAcquireResult> {
    const config = getApiConfig();
    const url = new URL('/internal/batch-lock/acquire', config.mainApiUrl);
    const response = await fetch(url, {
        method: 'POST',
        headers: withRequestIdHeader(
            withServiceAuthHeader({ 'Content-Type': 'application/json' }),
        ),
        body: JSON.stringify({ instanceId }),
        signal: AbortSignal.timeout(BATCH_LOCK_TIMEOUT_MS),
    });

    if (response.status === 409) {
        return { acquired: false };
    }
    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `batch-lock acquireに失敗しました (HTTP ${response.status}): ${text}`,
        );
    }

    const json: unknown = await response.json();
    return BatchLockAcquireResponseSchema.parse(json);
}

/**
 * batch実行ロックを解放する。instanceIdが現在の保持者と一致しない場合は
 * api側で何もしない（冪等）。
 * @param instanceId 解放するWorkflowインスタンスID
 * @throws {Error} 非2xxレスポンス、またはネットワークエラーの場合
 */
export async function releaseBatchLock(instanceId: string): Promise<void> {
    const config = getApiConfig();
    const url = new URL('/internal/batch-lock/release', config.mainApiUrl);
    const response = await fetch(url, {
        method: 'POST',
        headers: withRequestIdHeader(
            withServiceAuthHeader({ 'Content-Type': 'application/json' }),
        ),
        body: JSON.stringify({ instanceId }),
        signal: AbortSignal.timeout(BATCH_LOCK_TIMEOUT_MS),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `batch-lock releaseに失敗しました (HTTP ${response.status}): ${text}`,
        );
    }
}
