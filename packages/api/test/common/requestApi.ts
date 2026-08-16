import type { D1Database } from '@cloudflare/workers-types';

import { router } from '../../src/router';
import { buildMockHonoEnv } from './mockHonoEnv';

/**
 * コンポーネントテストから、本番と同じ `router`（Hono app）を経由して
 * 実HTTPリクエストを送るヘルパー。CORS・body-limit・cache-control等のミドルウェアも
 * 実際に通過するため、controller を直接呼ぶより本番の配線に忠実に検証できる。
 * @param db - EnvStore.env.DB / c.env.DB に設定する D1Database（テストごとに新規作成した InMemory D1）
 * @param path - リクエストパス（例: '/place?startDate=2026-01-01...'）
 * @param init - fetch の RequestInit（method・headers・body 等）
 */
export const requestApi = async (
    db: D1Database,
    path: string,
    init?: RequestInit,
): Promise<Response> =>
    router.fetch(
        new Request(`http://localhost${path}`, init),
        buildMockHonoEnv(db),
    );
