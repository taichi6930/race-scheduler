/**
 * Cloudflare GraphQL Analytics API（`workersInvocationsAdaptive`）を呼び出し、
 * 指定したWorker（scriptName）の直近のエラー数・リクエスト数を取得する。
 *
 * 元は `.github/workflows/error-monitor.yml` がGitHub Actions側で1時間おきに
 * 呼んでいたクエリと同一（CICD-122: Worker側移行）。
 */

import { appLogger } from '@race-schedule/core';

const CLOUDFLARE_GRAPHQL_ENDPOINT =
    'https://api.cloudflare.com/client/v4/graphql';

const ERROR_STATS_QUERY = `query ErrorCheck($accountTag: string!, $start: Time!, $end: Time!, $script: string!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        filter: { datetime_gt: $start, datetime_lt: $end, scriptName: $script }
        limit: 1
      ) {
        sum { requests errors }
      }
    }
  }
}`;

/** `workersInvocationsAdaptive`クエリの1件分の集計結果。 */
export interface WorkerErrorStats {
    errorCount: number;
    requestCount: number;
}

interface GraphQlResponseBody {
    errors?: unknown[];
    data?: {
        viewer?: {
            accounts?: {
                workersInvocationsAdaptive?: {
                    sum?: { requests?: number; errors?: number };
                }[];
            }[];
        };
    };
}

/**
 * 指定Workerの直近エラー数・リクエスト数を取得する。
 * HTTPエラー・GraphQLエラーレスポンスの場合はnullを返す（呼び出し側でスキップ扱いにする）。
 * @param apiToken - Account Analytics:Read権限を持つCloudflare APIトークン
 * @param accountId - Cloudflareアカウントtag
 * @param scriptName - 対象WorkerのスクリプトName（例: `race-schedule-prod`）
 * @param startIso - 集計期間の開始時刻（ISO8601、UTC）
 * @param endIso - 集計期間の終了時刻（ISO8601、UTC）
 */
export async function fetchWorkerErrorStats(
    apiToken: string,
    accountId: string,
    scriptName: string,
    startIso: string,
    endIso: string,
): Promise<WorkerErrorStats | null> {
    const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: ERROR_STATS_QUERY,
            variables: {
                accountTag: accountId,
                start: startIso,
                end: endIso,
                script: scriptName,
            },
        }),
    });

    if (!response.ok) {
        appLogger.warn(
            `[cloudflareAnalyticsClient] Cloudflare GraphQL API returned HTTP ${response.status} for ${scriptName}`,
        );
        return null;
    }

    const json = (await response.json()) as GraphQlResponseBody;

    if ((json.errors?.length ?? 0) > 0) {
        appLogger.warn(
            `[cloudflareAnalyticsClient] Cloudflare GraphQL API returned errors for ${scriptName}`,
            json.errors,
        );
        return null;
    }

    const sum =
        json.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0]?.sum;
    return {
        errorCount: sum?.errors ?? 0,
        requestCount: sum?.requests ?? 0,
    };
}
