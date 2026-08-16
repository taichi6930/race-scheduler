/**
 * scraping Worker（test 環境）→ api Worker のシークレット疎通確認（UAT smoke）
 *
 * @spec SPEC-API-001
 *
 * ## シナリオテーブル
 * | # | 対象 | 期待 |
 * |----|------|------|
 * | S1 | POST {SCRAPING_API_URL}/sync/race（認証ヘッダー付き・1970年の未実在 placeId） | 401にならず、レスポンスに "MAIN_API_URL environment variable is required" を含まないこと |
 * | S2 | POST {SCRAPING_API_URL}/sync/race（認証ヘッダー無し） | 401（サービス間認証が本番で実際に効いていることの確認） |
 *
 * 1970年の placeId を使うのは、実データが存在しない安全な入力で usecase 層
 * （scraping Worker が MAIN_API_URL を実際に使う箇所）まで到達させつつ、
 * 実質的な副作用（実データの書き込み）を避けるため
 * （`.github/workflows/deploy.yml` の Post-Deploy Verify と同じ手法）。
 *
 * `bun run test` 系には含まれない。実行: `bun run test:uat` / `uat-smoke.yml`。
 */
import { describe, expect, it } from 'bun:test';

import { fetchWithTimeout } from './fetchWithTimeout';

const SCRAPING_API_URL =
    process.env.SCRAPING_API_URL ??
    'https://race-schedule-scraping-test.tn-product.workers.dev';

const SERVICE_AUTH_TOKEN = process.env.SERVICE_AUTH_TOKEN ?? '';

const SYNC_RACE_BODY = JSON.stringify({
    placeIdList: ['jra1970010101'],
    placeHeldDaysMap: {},
});

/**
 * S1 用のタイムアウト（25 秒）。
 *
 * S1 は usecase 層まで到達させるため、scraping Worker が実際に対象サイトへ
 * スクレイピングしに行く。その 1 回分は
 * 「過負荷防止の待機 1 秒（HTML_FETCH_DELAY_MS 既定）＋ 最大 3 回のリトライ
 * （指数バックオフ 100ms/200ms）」で構成されるため、対象サイトの応答が
 * 1 回あたり 3 秒近くかかると既定の 10 秒を超えて AbortError になる。
 * 実際 2026-08-14 のタグデプロイでは 3 回中 2 回がこれで落ち、本番リリースが
 * 止まった。対象サイトの応答時間に左右されない余裕を持たせる。
 *
 * `test:uat` のランナー側タイムアウトは 30 秒（package.json の
 * `bun test --timeout 30000`）なので、それより確実に短い値にすること
 * （ci-conventions.md「実ネットワークに依存するテスト」の注意点）。
 */
const SYNC_RACE_TIMEOUT_MS = 25_000;

describe('UAT smoke: scraping Worker', () => {
    it('S1: /sync/race がMAIN_API_URLシークレット欠落エラーを返さないこと', async () => {
        const res = await fetchWithTimeout(
            `${SCRAPING_API_URL}/sync/race`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Auth-Token': SERVICE_AUTH_TOKEN,
                },
                body: SYNC_RACE_BODY,
            },
            SYNC_RACE_TIMEOUT_MS,
        );
        const body = await res.text();

        expect(res.status).not.toBe(401);
        expect(body).not.toContain(
            'MAIN_API_URL environment variable is required',
        );
    });

    it('S2: 認証ヘッダー無しの /sync/race は401になること（サービス間認証の本番確認）', async () => {
        const res = await fetchWithTimeout(`${SCRAPING_API_URL}/sync/race`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: SYNC_RACE_BODY,
        });

        expect(res.status).toBe(401);
    });
});
