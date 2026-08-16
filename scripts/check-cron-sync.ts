#!/usr/bin/env bun
/**
 * check-cron-sync.ts (QSYNC-01)
 *
 * `packages/api` のcron定義は `wrangler.toml` の `[env.production.triggers] crons`
 * と `src/scheduled.ts` の名前付きcron定数（`DATA_FRESHNESS_CRON` 等）にコメントのみで
 * 二重管理されており、片方だけ更新しても機械的には検知されない（更新し忘れると、
 * 該当ハンドラが本番で起動しない、または`event.cron`が一致せずWeb Push配信の
 * フォールバック分岐に誤って落ちる）。scheduled.ts が参照する全cron式が
 * wrangler.toml のproduction crons一覧に過不足なく含まれることを検証する。
 *
 * 使い方: bun scripts/check-cron-sync.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WRANGLER_PATH = join(import.meta.dir, '../packages/api/wrangler.toml');
const SCHEDULED_PATH = join(
    import.meta.dir,
    '../packages/api/src/scheduled.ts',
);

/**
 * Web Push配信用の既定cron。`scheduled.ts`では名前付き定数を持たず、
 * `event.cron`がどの名前付き定数にも一致しない場合のフォールバック分岐として
 * 扱われているため、名前付き定数とは別に期待値へ加える。
 */
export const WEB_PUSH_CRON = '* * * * *';

/**
 * `wrangler.toml`の`[env.production.triggers] crons`配列を抽出する。
 * @param wranglerContent - `wrangler.toml`の全文
 * @returns crons配列の各cron式（見つからない場合は空配列）
 */
export function extractProductionCrons(wranglerContent: string): string[] {
    const match = wranglerContent.match(
        /\[env\.production\.triggers\]\s*\ncrons\s*=\s*\[([^\]]*)\]/,
    );
    if (!match) return [];
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * `scheduled.ts`の`const XXX_CRON = '...'`形式の名前付きcron定数の値を抽出する。
 * @param scheduledContent - `scheduled.ts`の全文
 * @returns 名前付きcron定数の値の一覧
 */
export function extractNamedCronConstants(scheduledContent: string): string[] {
    const matches = scheduledContent.matchAll(
        /^const [A-Z_]+_CRON = '([^']+)';/gm,
    );
    return [...matches].map((m) => m[1]);
}

/**
 * 期待されるcron式のうち、`wrangler.toml`側に存在しないものを返す。
 * @param wranglerCrons - `wrangler.toml`のproduction crons一覧
 * @param expectedCrons - `scheduled.ts`が参照するcron式の一覧
 * @returns `wrangler.toml`に無いcron式（順序はexpectedCrons準拠）
 */
export function findMissingCrons(
    wranglerCrons: string[],
    expectedCrons: string[],
): string[] {
    return expectedCrons.filter((cron) => !wranglerCrons.includes(cron));
}

if (import.meta.main) {
    const wranglerContent = readFileSync(WRANGLER_PATH, 'utf-8');
    const scheduledContent = readFileSync(SCHEDULED_PATH, 'utf-8');
    const wranglerCrons = extractProductionCrons(wranglerContent);
    const expectedCrons = [
        WEB_PUSH_CRON,
        ...extractNamedCronConstants(scheduledContent),
    ];
    const missing = findMissingCrons(wranglerCrons, expectedCrons);

    if (missing.length > 0) {
        console.error(
            '❌ packages/api/wrangler.toml の [env.production.triggers] crons に、' +
                'scheduled.ts が参照するcron式が含まれていません:',
        );
        for (const cron of missing) {
            console.error(`  - ${cron}`);
        }
        console.error(
            '  scheduled.ts の名前付きcron定数と wrangler.toml の production crons を一致させてください。',
        );
        process.exit(1);
    }

    console.log(
        `✅ api Workerのcron定義が一致しています（${String(wranglerCrons.length)}件）`,
    );
}
