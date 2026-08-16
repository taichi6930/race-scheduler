/**
 * api Worker（test 環境）への疎通確認（UAT smoke）
 *
 * ## シナリオテーブル
 * | # | 対象 | 期待 |
 * |----|------|------|
 * | S1 | GET {MAIN_API_URL}/health | 200 応答、Worker が起動していることを確認 |
 *
 * 実際にデプロイされた test 環境 Worker へ本物の HTTP リクエストを送る。
 * `bun run test` / `test:unit` / `test:component` / `test:sit` には含まれない
 * （`tests/uat/` は bunfig.toml の `root: "packages"` の対象外のため自動実行されない）。
 * 実行: `bun run test:uat`（ローカル）/ `.github/workflows/uat-smoke.yml`（定期・手動実行）。
 */
import { describe, expect, it } from 'bun:test';

import { fetchWithTimeout } from './fetchWithTimeout';

const MAIN_API_URL =
    process.env.MAIN_API_URL ??
    'https://race-schedule-test.tn-product.workers.dev';

describe('UAT smoke: api Worker', () => {
    it('S1: GET /health が200で応答すること', async () => {
        const res = await fetchWithTimeout(`${MAIN_API_URL}/health`);

        expect(res.status).toBe(200);
    });
});
