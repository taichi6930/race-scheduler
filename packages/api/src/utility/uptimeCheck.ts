/**
 * Uptime監視（uptime-check.ymlのWorker側移行）のオーケストレーション。
 * `scheduled.ts` から呼ばれ、対象Worker（api/admin/batch/calendar/scraping）それぞれの
 * `/health`エンドポイントへHTTP GETし、`uptimeCheckNotifier.syncUptimeCheckIssue`
 * へ渡す。
 * @remarks
 * **既知の制約（自己監視のブラインドスポット）**: `errorMonitorCheck.ts`と同様、
 * 本チェックはapi Worker自身のscheduledハンドラとして動作するため、api自体が
 * 完全にクラッシュしてscheduledハンドラそのものが実行できない状態になった場合、
 * api自身だけでなくadmin/batch/calendar/scrapingの疎通監視も同時に止まる。
 * GitHub Actions側（`uptime-check.yml`）は、この制約を踏まえ並行稼働期間を経て
 * からカットオーバー判断を行う（`docs/tasks/BACKLOG.md` 参照）。
 */

import type { IGithubIssueGateway } from '@race-schedule/core';
import {
    appLogger,
    EnvStore,
    GithubIssueGateway,
    sleep,
} from '@race-schedule/core';

import { syncUptimeCheckIssue } from './uptimeCheckNotifier';

/**
 * 監視対象キーと`/health`エンドポイントURLの対応（uptime-check.ymlと同一）。
 * admin（障害対応そのものに使う画面）はQRUN-02で対象に追加した。
 */
const TARGET_URLS: Record<string, string> = {
    api: 'https://race-schedule-prod.tn-product.workers.dev/health',
    admin: 'https://race-schedule-admin-prod.tn-product.workers.dev/health',
    batch: 'https://race-schedule-batch-prod.tn-product.workers.dev/health',
    calendar:
        'https://race-schedule-calendar-prod.tn-product.workers.dev/health',
    scraping:
        'https://race-schedule-scraping-prod.tn-product.workers.dev/health',
};

/** 全監視対象キー（api/admin/batch/calendar/scraping）。 */
export const ALL_UPTIME_CHECK_TARGETS = Object.keys(TARGET_URLS);

/** `/health`へのリクエストタイムアウト（ミリ秒）。uptime-check.ymlの`--max-time 10`と同じ。 */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * ヘルスチェックの最大試行回数（初回1回＋リトライ2回＝計3回、QRUN-08）。
 * Cloudflareのコールドスタート・瞬間的なネットワーク不調による誤検知
 * （実際にはダウンしていないのに「down」のGitHub Issueが起票される）を
 * 避けるため、失敗時のみ短い間隔を空けて再試行してから最終結果を確定する。
 * `packages/batch/src/client/http.ts`の`fetchWithRetry`（PERF-055）と同じ
 * 「一時的な失敗は指数バックオフでリトライ」という設計方針を踏襲する。
 */
const MAX_PING_ATTEMPTS = 3;

/**
 * リトライ間隔の基準値（ミリ秒）。試行回数（0始まり）を指数として
 * `PING_RETRY_BASE_DELAY_MS * 2 ** attempt` で待機時間を算出する（100ms, 200ms）。
 * `http.ts`の`RETRY_BASE_DELAY_MS`と同じ値。
 */
const PING_RETRY_BASE_DELAY_MS = 100;

/**
 * 対象URLへ`/health`のHTTP GETを1回だけ行い、疎通結果を返す。
 * タイムアウト・ネットワークエラー時はhealthy:false, httpStatus:0を返す
 * （例外は投げない）。
 */
async function attemptPingHealth(
    targetUrl: string,
): Promise<{ healthy: boolean; httpStatus: number }> {
    try {
        const response = await fetch(targetUrl, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        return {
            healthy: response.status === 200,
            httpStatus: response.status,
        };
    } catch (error) {
        appLogger.warn(
            `[uptimeCheck] ${targetUrl} への疎通に失敗しました`,
            error,
        );
        return { healthy: false, httpStatus: 0 };
    }
}

/**
 * 対象URLへ`/health`のHTTP GETを行い、疎通結果を返す。
 * 失敗（healthy:false）した場合は`MAX_PING_ATTEMPTS`回に達するまで短い間隔
 * （指数バックオフ）を空けて再試行し、最後の試行結果を返す（QRUN-08）。
 * いずれの試行も例外は投げない（`attemptPingHealth`が内部で捕捉するため）。
 */
async function pingHealth(
    targetUrl: string,
): Promise<{ healthy: boolean; httpStatus: number }> {
    let lastResult: { healthy: boolean; httpStatus: number } = {
        healthy: false,
        httpStatus: 0,
    };
    for (let attempt = 0; attempt < MAX_PING_ATTEMPTS; attempt++) {
        lastResult = await attemptPingHealth(targetUrl);
        if (lastResult.healthy) {
            return lastResult;
        }
        const isLastAttempt = attempt === MAX_PING_ATTEMPTS - 1;
        if (!isLastAttempt) {
            await sleep(PING_RETRY_BASE_DELAY_MS * 2 ** attempt);
        }
    }
    return lastResult;
}

/** 1対象分のチェックを実行する。 */
async function checkOneTarget(
    targetKey: string,
    targetUrl: string,
    gateway: IGithubIssueGateway,
    githubToken: string,
): Promise<void> {
    const { healthy, httpStatus } = await pingHealth(targetUrl);
    appLogger.info(
        `[uptimeCheck] ${targetKey}: status=${httpStatus} healthy=${healthy}`,
    );
    await syncUptimeCheckIssue(
        { targetKey, targetUrl, healthy, httpStatus },
        gateway,
        githubToken,
    );
}

/**
 * Uptimeチェックを1回実行する。`GITHUB_TOKEN`が未設定の場合は何もせず
 * スキップする（graceful degradation）。1対象のチェックが失敗しても他対象の
 * チェックは継続する（uptime-check.ymlのサブシェル隔離と同じ設計方針）。
 * `pingHealth`/`syncUptimeCheckIssue`はいずれも自身で例外を捕捉し例外を
 * 投げない設計のため、`checkOneTarget`自体を追加でtry/catchする必要はない
 * （errorMonitorCheck.tsと異なり、`fetch`の失敗自体がUptime監視における
 * 「異常検知」の一部＝素通りさせず必ずhealthy:falseとして通知する必要が
 * あるため、`pingHealth`内で捕捉する設計にしている）。
 * @param targets - チェック対象キーの配列（既定: 全5Worker）
 */
export async function runUptimeCheck(
    targets: string[] = ALL_UPTIME_CHECK_TARGETS,
): Promise<void> {
    const githubToken = EnvStore.env.GITHUB_TOKEN;
    if (!githubToken) {
        appLogger.warn(
            '[uptimeCheck] GITHUB_TOKEN が未設定のためスキップします',
        );
        return;
    }

    const gateway = new GithubIssueGateway('race-schedule-api');

    for (const targetKey of targets) {
        const targetUrl = TARGET_URLS[targetKey];
        if (!targetUrl) {
            appLogger.warn(
                `[uptimeCheck] 未知の監視対象キーです: ${targetKey}`,
            );
            continue;
        }
        await checkOneTarget(targetKey, targetUrl, gateway, githubToken);
    }
}
