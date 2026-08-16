import type { ScheduledEvent } from '@cloudflare/workers-types';
import type { CloudFlareEnv } from '@race-schedule/core';
import { appLogger, DI_TOKENS } from '@race-schedule/core';
import { container } from 'tsyringe';

import { ensureDIInitialized } from './router';
import type { IPushUsecase } from './usecase/interface/IPushUsecase';
import { runDataFreshnessCheck } from './utility/dataFreshnessCheck';
import { runDataQualityWarningCheck } from './utility/dataQualityWarningCheck';
import { runErrorMonitorCheck } from './utility/errorMonitorCheck';
import { runUptimeCheck } from './utility/uptimeCheck';

/**
 * データ鮮度チェック（CICD-121）用のcron式。`wrangler.toml`の
 * `[env.production.triggers] crons`に登録されている値と完全に一致させること
 * （元のhealth-check-data-freshness.ymlと同じ 毎日 14:00 JST = 05:00 UTC）。
 */
const DATA_FRESHNESS_CRON = '0 5 * * *';

/**
 * エラー監視（CICD-122）用のcron式。`wrangler.toml`の
 * `[env.production.triggers] crons`に登録されている値と完全に一致させること
 * （元のerror-monitor.ymlと同じ 毎時 + apiのみ毎時30分、OBS-012相当）。
 */
const ERROR_MONITOR_FULL_CRON = '0 * * * *';
const ERROR_MONITOR_API_ONLY_CRON = '30 * * * *';

/**
 * Uptime監視用のcron式。`wrangler.toml`の`[env.production.triggers] crons`に
 * 登録されている値と完全に一致させること（元のuptime-check.ymlと同じ15分おき）。
 */
const UPTIME_CHECK_CRON = '*/15 * * * *';

/**
 * Cloudflare `scheduled` ハンドラ（`wrangler.toml` の `[triggers] crons` 参照）。
 * 複数のcronトリガーを1つのハンドラで受け、`event.cron`で分岐する。
 * - `* * * * *`（毎分、既定）: 期限到来した Web Push 予約を配信する
 *   （`PushUsecase.dispatchDue`。このリポジトリ初の `scheduled` ハンドラ、
 *   web-push-design.md §5）。
 * - `DATA_FRESHNESS_CRON`（毎日）: 本番データの鮮度チェック（CICD-121、
 *   元は`health-check-data-freshness.yml`がGitHub Actions側で1日1回実行していた）。
 *   未使用のWeb Push購読のパージ（SEC-053、`PushUsecase.purgeStaleSubscriptions`）も
 *   同じcronに相乗りさせている。
 * - `ERROR_MONITOR_FULL_CRON`（毎時）/ `ERROR_MONITOR_API_ONLY_CRON`（毎時30分、
 *   apiのみ）: Cloudflareのエラー監視（CICD-122、元は`error-monitor.yml`が
 *   GitHub Actions側で実行していた）。`ERROR_MONITOR_FULL_CRON`には、
 *   `data_quality_warning_log`（PlaceRepository.fetch等がマッピング失敗行を
 *   記録する）を直近ウィンドウで集計するデータ品質警告監視（DATA-01）も
 *   相乗りさせている。
 * - `UPTIME_CHECK_CRON`（15分おき）: 各Workerの`/health`疎通監視（元は
 *   `uptime-check.yml`がGitHub Actions側で実行していた）。
 * @remarks
 * Cloudflare は `scheduled(event, env, ctx)` の順で呼び出すため、
 * `ctx`（3番目）は未使用な末尾引数のため宣言を省略する
 * （JS は宣言より多い実引数を渡されても動作する）。
 * @param event - Cloudflare の ScheduledEvent（`cron`でどのトリガーが発火したか判定する）
 * @param env - Cloudflare Workers の環境変数
 */
export async function scheduled(
    event: ScheduledEvent,
    env: CloudFlareEnv,
): Promise<void> {
    ensureDIInitialized(env);

    if (event.cron === DATA_FRESHNESS_CRON) {
        await runDataFreshnessCheck(new Date());
        // SEC-053: 未使用のWeb Push購読を1日1回パージする（毎分のdispatchDueに
        // 相乗りさせず、変化の少ない判定を別cronへ分離する）。
        const pushUsecase = container.resolve<IPushUsecase>(
            DI_TOKENS.PushUsecase,
        );
        await pushUsecase.purgeStaleSubscriptions();
        return;
    }

    if (event.cron === ERROR_MONITOR_FULL_CRON) {
        await runErrorMonitorCheck(new Date());
        await runDataQualityWarningCheck(new Date());
        return;
    }

    if (event.cron === ERROR_MONITOR_API_ONLY_CRON) {
        await runErrorMonitorCheck(new Date(), ['api']);
        return;
    }

    if (event.cron === UPTIME_CHECK_CRON) {
        await runUptimeCheck();
        return;
    }

    // CONC-07: cronで毎分呼ばれるハンドラのため、1回の失敗で例外を外へ投げず、
    // ログに残したうえで次回の起動に委ねる（scheduledハンドラ自体が未処理例外を
    // 投げるとCloudflare側にエラーとして記録されるだけで自動リトライは保証されない）。
    try {
        const usecase = container.resolve<IPushUsecase>(DI_TOKENS.PushUsecase);
        const result = await usecase.dispatchDue(Date.now());
        appLogger.info('Web Push dispatch (scheduled)', result);
    } catch (error) {
        appLogger.error('Web Push dispatch (scheduled) failed', error);
    }
}
