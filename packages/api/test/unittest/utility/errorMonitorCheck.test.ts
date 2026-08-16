/**
 * runErrorMonitorCheck のテスト
 *
 * @spec なし（CICD-122: error-monitor.ymlのWorker側移行）
 *
 * ## デシジョンテーブル
 *
 * | #    | 必須シークレット                              | targets      | GraphQLレスポンス                      | 期待挙動                                        |
 * |------|--------------------------------------------------|--------------|-------------------------------------------|----------------------------------------------------|
 * | T-01 | GITHUB_TOKEN未設定                                | 既定（全5件） | -                                          | Cloudflare GraphQL APIが呼ばれない（即return）      |
 * | T-02 | CLOUDFLARE_ANALYTICS_API_TOKEN未設定              | 既定（全5件） | -                                          | Cloudflare GraphQL APIが呼ばれない（即return）      |
 * | T-03 | CLOUDFLARE_ACCOUNT_ID未設定                       | 既定（全5件） | -                                          | Cloudflare GraphQL APIが呼ばれない（即return）      |
 * | T-04 | 全て設定                                          | 既定（全5件） | 全てerrors:0                              | GraphQL APIが5回呼ばれ、GitHub書き込み系は呼ばれない |
 * | T-05 | 全て設定                                          | ['api']      | errors:0                                  | GraphQL APIが1回だけ呼ばれる                        |
 * | T-06 | 全て設定                                          | 既定（全5件） | apiのみerrors>0                           | GitHub Issue作成（POST /issues）が1回呼ばれる       |
 * | T-07 | 全て設定                                          | 既定（全5件） | 1件がfetch自体で例外                       | 他の対象は継続してGraphQL APIが呼ばれる             |
 * | T-08 | 全て設定                                          | ['unknown']  | -                                          | 未知キーはスキップされCloudflare GraphQL APIは呼ばれない |
 * | T-09 | 全て設定                                          | ['api']      | HTTP 500（GraphQL API失敗）                | 通知されずスキップされる（GitHub APIは呼ばれない）   |
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import { EnvStore } from '@race-schedule/core';

import { runErrorMonitorCheck } from '../../../src/utility/errorMonitorCheck';

interface FakeResponse {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}
type FetchHandler = (
    url: string,
    init?: { method?: string; body?: string },
) => Promise<FakeResponse>;

/**
 * URLのホスト名が指定した値と一致するかを判定する。
 * `url.includes(host)`のような部分文字列一致は、`evil.com/api.cloudflare.com`や
 * `api.cloudflare.com.evil.com`のような文字列にも誤ってマッチしうる
 * （CodeQL `js/incomplete-url-substring-sanitization`）ため、`URL`でパースして
 * ホスト名を厳密に比較する。
 * @param urlString - 判定対象のURL文字列
 * @param host - 期待するホスト名
 */
function hasHost(urlString: string, host: string): boolean {
    return new URL(urlString).hostname === host;
}

const okJson = (data: unknown): FakeResponse => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
});

const scriptNameFromBody = (body?: string): string | undefined => {
    if (!body) {
        return undefined;
    }
    const parsed = JSON.parse(body) as { variables?: { script?: string } };
    return parsed.variables?.script;
};

const setFetch = (
    handler: FetchHandler,
): { calls: { url: string; init?: { method?: string; body?: string } }[] } => {
    const calls: {
        url: string;
        init?: { method?: string; body?: string };
    }[] = [];
    const fn = mock(
        (url: string, init?: { method?: string; body?: string }) => {
            calls.push({ url, init });
            return handler(url, init);
        },
    );
    globalThis.fetch = fn as unknown as typeof globalThis.fetch;
    return { calls };
};

const MINIMAL_ENV = {
    JRA_CALENDAR_ID: 'mock',
    NAR_CALENDAR_ID: 'mock',
    WORLD_CALENDAR_ID: 'mock',
    KEIRIN_CALENDAR_ID: 'mock',
    AUTORACE_CALENDAR_ID: 'mock',
    BOATRACE_CALENDAR_ID: 'mock',
    GOOGLE_CLIENT_EMAIL: 'mock@example.com',
    GOOGLE_PRIVATE_KEY: 'mock',
    R2_BUCKET: {},
};

const FULL_ENV = {
    ...MINIMAL_ENV,
    GITHUB_TOKEN: 'gh-token',
    CLOUDFLARE_ANALYTICS_API_TOKEN: 'cf-token',
    CLOUDFLARE_ACCOUNT_ID: 'cf-account',
};

/** 全対象0件エラーを返すfetchハンドラ。 */
const zeroErrorsHandler: FetchHandler = (url) => {
    if (hasHost(url, 'api.cloudflare.com')) {
        return Promise.resolve(
            okJson({
                data: {
                    viewer: {
                        accounts: [
                            {
                                workersInvocationsAdaptive: [
                                    { sum: { errors: 0, requests: 10 } },
                                ],
                            },
                        ],
                    },
                },
            }),
        );
    }
    return Promise.resolve(okJson([]));
};

describe('runErrorMonitorCheck', () => {
    afterEach(() => {
        EnvStore.reset();
    });

    it('T-01: GITHUB_TOKEN未設定ならCloudflare GraphQL APIを呼ばずreturnする', async () => {
        EnvStore.setEnv(
            {
                ...MINIMAL_ENV,
                CLOUDFLARE_ANALYTICS_API_TOKEN: 'cf-token',
                CLOUDFLARE_ACCOUNT_ID: 'cf-account',
            } as never,
            [],
        );
        const { calls } = setFetch(zeroErrorsHandler);

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'));

        expect(calls).toHaveLength(0);
    });

    it('T-02: CLOUDFLARE_ANALYTICS_API_TOKEN未設定ならCloudflare GraphQL APIを呼ばずreturnする', async () => {
        EnvStore.setEnv(
            {
                ...MINIMAL_ENV,
                GITHUB_TOKEN: 'gh-token',
                CLOUDFLARE_ACCOUNT_ID: 'cf-account',
            } as never,
            [],
        );
        const { calls } = setFetch(zeroErrorsHandler);

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'));

        expect(calls).toHaveLength(0);
    });

    it('T-03: CLOUDFLARE_ACCOUNT_ID未設定ならCloudflare GraphQL APIを呼ばずreturnする', async () => {
        EnvStore.setEnv(
            {
                ...MINIMAL_ENV,
                GITHUB_TOKEN: 'gh-token',
                CLOUDFLARE_ANALYTICS_API_TOKEN: 'cf-token',
            } as never,
            [],
        );
        const { calls } = setFetch(zeroErrorsHandler);

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'));

        expect(calls).toHaveLength(0);
    });

    it('T-04: 全シークレット設定済み・全対象0件エラーならGraphQL APIが4回呼ばれGitHub書き込みは無い', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch(zeroErrorsHandler);

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'));

        const cfCalls = calls.filter((c) =>
            hasHost(c.url, 'api.cloudflare.com'),
        );
        expect(cfCalls).toHaveLength(5);
        const githubWriteCalls = calls.filter(
            (c) =>
                c.init?.method === 'POST' && hasHost(c.url, 'api.github.com'),
        );
        expect(githubWriteCalls).toHaveLength(0);
    });

    it('T-05: targetsに["api"]のみ渡すとGraphQL APIが1回だけ呼ばれる', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch(zeroErrorsHandler);

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'), ['api']);

        const cfCalls = calls.filter((c) =>
            hasHost(c.url, 'api.cloudflare.com'),
        );
        expect(cfCalls).toHaveLength(1);
        expect(scriptNameFromBody(cfCalls[0]?.init?.body)).toBe(
            'race-schedule-prod',
        );
    });

    it('T-06: apiのみerrorCount>0ならGitHub Issue作成が1回呼ばれる', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch((url, init) => {
            if (hasHost(url, 'api.cloudflare.com')) {
                const script = scriptNameFromBody(init?.body);
                const errors = script === 'race-schedule-prod' ? 2 : 0;
                return Promise.resolve(
                    okJson({
                        data: {
                            viewer: {
                                accounts: [
                                    {
                                        workersInvocationsAdaptive: [
                                            { sum: { errors, requests: 10 } },
                                        ],
                                    },
                                ],
                            },
                        },
                    }),
                );
            }
            if (init?.method === 'POST') {
                return Promise.resolve(okJson({ number: 55 }));
            }
            return Promise.resolve(okJson([]));
        });

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'));

        const createCalls = calls.filter(
            (c) =>
                c.init?.method === 'POST' && hasHost(c.url, 'api.github.com'),
        );
        expect(createCalls).toHaveLength(1);
    });

    it('T-07: 1対象がfetch自体で例外を投げても他対象は継続する', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        let callCount = 0;
        const { calls } = setFetch((url, init) => {
            if (hasHost(url, 'api.cloudflare.com')) {
                callCount += 1;
                if (callCount === 1) {
                    return Promise.reject(new Error('network error'));
                }
                return zeroErrorsHandler(url, init);
            }
            return zeroErrorsHandler(url, init);
        });

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'));

        const cfCalls = calls.filter((c) =>
            hasHost(c.url, 'api.cloudflare.com'),
        );
        expect(cfCalls).toHaveLength(5);
    });

    it('T-09: GraphQL APIがHTTPエラーを返した対象は通知されず処理をスキップする', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch((url, init) => {
            if (hasHost(url, 'api.cloudflare.com')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({}),
                });
            }
            return zeroErrorsHandler(url, init);
        });

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'), ['api']);

        const githubCalls = calls.filter((c) =>
            hasHost(c.url, 'api.github.com'),
        );
        expect(githubCalls).toHaveLength(0);
    });

    it('T-08: 未知のtargetキーはスキップされCloudflare GraphQL APIは呼ばれない', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch(zeroErrorsHandler);

        await runErrorMonitorCheck(new Date('2026-08-05T01:00:00Z'), [
            'unknown',
        ]);

        expect(calls).toHaveLength(0);
    });
});
