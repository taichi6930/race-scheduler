/**
 * fetchWorkerErrorStats のテスト
 *
 * @spec なし（CICD-122: error-monitor.ymlのWorker側移行）
 *
 * ## デシジョンテーブル
 *
 * | #    | HTTPステータス | GraphQLレスポンス                                        | 期待値                          |
 * |------|-----------------|-------------------------------------------------------------|----------------------------------|
 * | T-01 | 200             | data.viewer.accounts[0].workersInvocationsAdaptive[0].sum あり | { errorCount, requestCount } を返す |
 * | T-02 | 200             | errors配列あり（GraphQLエラー）                              | null を返す                      |
 * | T-03 | 200             | dataはあるがsumが無い（対象期間データ無し）                  | { errorCount: 0, requestCount: 0 } |
 * | T-04 | 500             | -                                                             | null を返す                      |
 */

import { describe, expect, it, mock } from 'bun:test';

import { fetchWorkerErrorStats } from '../../../src/utility/cloudflareAnalyticsClient';

interface FakeResponse {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}

const setFetch = (response: FakeResponse): void => {
    globalThis.fetch = mock(() =>
        Promise.resolve(response),
    ) as unknown as typeof fetch;
};

describe('fetchWorkerErrorStats', () => {
    it('T-01: sumがあればerrorCount/requestCountを返す', async () => {
        setFetch({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    data: {
                        viewer: {
                            accounts: [
                                {
                                    workersInvocationsAdaptive: [
                                        { sum: { errors: 3, requests: 120 } },
                                    ],
                                },
                            ],
                        },
                    },
                }),
        });

        const result = await fetchWorkerErrorStats(
            'token',
            'account',
            'race-schedule-prod',
            '2026-08-05T00:00:00Z',
            '2026-08-05T01:00:00Z',
        );

        expect(result).toEqual({ errorCount: 3, requestCount: 120 });
    });

    it('T-02: GraphQLエラーレスポンスならnullを返す', async () => {
        setFetch({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({ errors: [{ message: 'invalid query' }] }),
        });

        const result = await fetchWorkerErrorStats(
            'token',
            'account',
            'race-schedule-prod',
            '2026-08-05T00:00:00Z',
            '2026-08-05T01:00:00Z',
        );

        expect(result).toBeNull();
    });

    it('T-03: sumが無ければerrorCount/requestCountとも0を返す', async () => {
        setFetch({
            ok: true,
            status: 200,
            json: () =>
                Promise.resolve({
                    data: { viewer: { accounts: [{}] } },
                }),
        });

        const result = await fetchWorkerErrorStats(
            'token',
            'account',
            'race-schedule-prod',
            '2026-08-05T00:00:00Z',
            '2026-08-05T01:00:00Z',
        );

        expect(result).toEqual({ errorCount: 0, requestCount: 0 });
    });

    it('T-04: HTTPエラーならnullを返す', async () => {
        setFetch({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
        });

        const result = await fetchWorkerErrorStats(
            'token',
            'account',
            'race-schedule-prod',
            '2026-08-05T00:00:00Z',
            '2026-08-05T01:00:00Z',
        );

        expect(result).toBeNull();
    });
});
