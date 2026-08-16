/**
 * calendar Worker（test 環境）→ api Worker のシークレット疎通確認（UAT smoke）
 *
 * @spec SPEC-API-001
 *
 * ## シナリオテーブル
 * | # | 対象 | 期待 |
 * |----|------|------|
 * | S1 | POST {CALENDAR_API_URL}/sync（認証ヘッダー付き・1970-01-01の未実在期間） | 401にならず、レスポンスに "MAIN_API_URL environment variable is required" を含まないこと |
 * | S2 | POST {CALENDAR_API_URL}/sync（認証ヘッダー無し） | 401（サービス間認証が本番で実際に効いていることの確認） |
 *
 * 1970-01-01 を使うのは、実データが存在しない安全な入力で usecase 層
 * （calendar Worker が MAIN_API_URL を実際に使う箇所）まで到達させつつ、
 * 実質的な副作用（Google Calendarへの実書き込み）を避けるため
 * （`.github/workflows/deploy.yml` の Post-Deploy Verify と同じ手法）。
 *
 * `bun run test` 系には含まれない。実行: `bun run test:uat` / `uat-smoke.yml`。
 */
import { describe, expect, it } from 'bun:test';

import { fetchWithTimeout } from './fetchWithTimeout';

const CALENDAR_API_URL =
    process.env.CALENDAR_API_URL ??
    'https://race-schedule-calendar-test.tn-product.workers.dev';

const SERVICE_AUTH_TOKEN = process.env.SERVICE_AUTH_TOKEN ?? '';

const SYNC_BODY = JSON.stringify({
    raceTypeList: ['jra'],
    startDate: '1970-01-01',
    finishDate: '1970-01-01',
});

describe('UAT smoke: calendar Worker', () => {
    it('S1: /sync がMAIN_API_URLシークレット欠落エラーを返さないこと', async () => {
        const res = await fetchWithTimeout(`${CALENDAR_API_URL}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Service-Auth-Token': SERVICE_AUTH_TOKEN,
            },
            body: SYNC_BODY,
        });
        const body = await res.text();

        expect(res.status).not.toBe(401);
        expect(body).not.toContain(
            'MAIN_API_URL environment variable is required',
        );
    });

    it('S2: 認証ヘッダー無しの /sync は401になること（サービス間認証の本番確認）', async () => {
        const res = await fetchWithTimeout(`${CALENDAR_API_URL}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: SYNC_BODY,
        });

        expect(res.status).toBe(401);
    });
});
