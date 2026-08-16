/**
 * runUptimeCheck のテスト
 *
 * @spec なし（uptime-check.ymlのWorker側移行）
 *
 * ## デシジョンテーブル
 *
 * | #    | GITHUB_TOKEN | targets      | /health応答                | 期待挙動                                        |
 * |------|--------------|--------------|-------------------------------|----------------------------------------------------|
 * | T-01 | 未設定       | 既定（全5件） | -                              | /healthへのfetchが呼ばれない（即return）           |
 * | T-02 | 設定         | 既定（全5件） | 全て200                        | /healthへのfetchが5回呼ばれ、GitHub書き込みは無い   |
 * | T-03 | 設定         | ['api']      | 200                             | /healthへのfetchが1回だけ呼ばれる                   |
 * | T-04 | 設定         | 既定（全5件） | apiのみ500                     | GitHub Issue作成（POST /issues）が1回呼ばれる       |
 * | T-05 | 設定         | 既定（全5件） | 1件がfetch自体で例外（タイムアウト相当、毎回失敗） | 例外にならずhealthy=falseとして扱われ他対象は継続、当該対象はリトライ上限(3回)まで試行 |
 * | T-06 | 設定         | ['unknown']  | -                               | 未知キーはスキップされ/healthへのfetchは呼ばれない   |
 * | T-07 | 設定         | ['api']      | 1回目で200                     | リトライせずfetchが1回だけ呼ばれ健全と判定される（QRUN-08） |
 * | T-08 | 設定         | ['api']      | 1回目500→2回目200               | fetchが2回呼ばれ最終的に健全と判定される（GitHub Issue作成なし、QRUN-08） |
 * | T-09 | 設定         | ['api']      | 3回とも500                     | fetchが3回（上限）呼ばれた後、不健全としてGitHub Issue作成が1回呼ばれる（QRUN-08） |
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import { EnvStore } from '@race-schedule/core';

import { runUptimeCheck } from '../../../src/utility/uptimeCheck';

interface FakeResponse {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}
type FetchHandler = (
    url: string,
    init?: { method?: string },
) => Promise<FakeResponse>;

/**
 * URLのホスト名が指定した値と一致するかを判定する（CodeQL
 * `js/incomplete-url-substring-sanitization`対応、
 * `errorMonitorCheck.test.ts`のhasHostと同じ設計）。
 */
function hasHost(urlString: string, host: string): boolean {
    return new URL(urlString).hostname === host;
}

const okJson = (data: unknown): FakeResponse => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
});

const setFetch = (
    handler: FetchHandler,
): { calls: { url: string; init?: { method?: string } }[] } => {
    const calls: { url: string; init?: { method?: string } }[] = [];
    const fn = mock((url: string, init?: { method?: string }) => {
        calls.push({ url, init });
        return handler(url, init);
    });
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
};

const isGithubUrl = (url: string): boolean => hasHost(url, 'api.github.com');
const isApiHealthUrl = (url: string): boolean =>
    hasHost(url, 'race-schedule-prod.tn-product.workers.dev');

/** 全対象200を返すfetchハンドラ。 */
const allHealthyHandler: FetchHandler = (url, init) => {
    if (isGithubUrl(url)) {
        if (init?.method === 'POST') {
            return Promise.resolve(okJson({ number: 99 }));
        }
        return Promise.resolve(okJson([]));
    }
    return Promise.resolve(okJson({ status: 'ok' }));
};

describe('runUptimeCheck', () => {
    afterEach(() => {
        EnvStore.reset();
    });

    it('T-01: GITHUB_TOKEN未設定なら/healthへのfetchを呼ばずreturnする', async () => {
        EnvStore.setEnv({ ...MINIMAL_ENV } as never, []);
        const { calls } = setFetch(allHealthyHandler);

        await runUptimeCheck();

        expect(calls).toHaveLength(0);
    });

    it('T-02: 全対象200ならfetchが5回呼ばれGitHub書き込みは無い', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch(allHealthyHandler);

        await runUptimeCheck();

        const healthCalls = calls.filter((c) => !isGithubUrl(c.url));
        expect(healthCalls).toHaveLength(5);
        const githubWriteCalls = calls.filter(
            (c) => c.init?.method === 'POST' && isGithubUrl(c.url),
        );
        expect(githubWriteCalls).toHaveLength(0);
    });

    it('T-03: targetsに["api"]のみ渡すとfetchが1回だけ呼ばれる', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch(allHealthyHandler);

        await runUptimeCheck(['api']);

        const healthCalls = calls.filter((c) => !isGithubUrl(c.url));
        expect(healthCalls).toHaveLength(1);
        expect(healthCalls[0]?.url).toContain('race-schedule-prod');
    });

    it('T-04: apiのみ500ならGitHub Issue作成が1回呼ばれる', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch((url, init) => {
            if (isGithubUrl(url)) {
                if (init?.method === 'POST') {
                    return Promise.resolve(okJson({ number: 55 }));
                }
                return Promise.resolve(okJson([]));
            }
            if (isApiHealthUrl(url)) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({}),
                });
            }
            return Promise.resolve(okJson({ status: 'ok' }));
        });

        await runUptimeCheck();

        const createCalls = calls.filter(
            (c) => c.init?.method === 'POST' && isGithubUrl(c.url),
        );
        expect(createCalls).toHaveLength(1);
    });

    it('T-05: 1対象がfetch自体で例外を投げても他対象は継続する', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch((url, init) => {
            if (isGithubUrl(url)) {
                return Promise.resolve(okJson([]));
            }
            if (isApiHealthUrl(url)) {
                return Promise.reject(new Error('timeout'));
            }
            return allHealthyHandler(url, init);
        });

        await runUptimeCheck();

        const healthCalls = calls.filter((c) => !isGithubUrl(c.url));
        // 例外を返し続けるapiのみリトライ上限(3回)まで試行され、他4対象は1回ずつ
        // （4 * 1 + 3 = 7）。
        expect(healthCalls).toHaveLength(7);
        const apiHealthCalls = healthCalls.filter((c) => isApiHealthUrl(c.url));
        expect(apiHealthCalls).toHaveLength(3);
    });

    it('T-06: 未知のtargetキーはスキップされ/healthへのfetchは呼ばれない', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch(allHealthyHandler);

        await runUptimeCheck(['unknown']);

        expect(calls).toHaveLength(0);
    });

    it('T-07: 初回で200が返れば1回のfetchでリトライせず健全と判定される', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch(allHealthyHandler);

        await runUptimeCheck(['api']);

        const healthCalls = calls.filter((c) => !isGithubUrl(c.url));
        expect(healthCalls).toHaveLength(1);
        const createCalls = calls.filter(
            (c) => c.init?.method === 'POST' && isGithubUrl(c.url),
        );
        expect(createCalls).toHaveLength(0);
    });

    it('T-08: 1回目500・2回目200なら2回のfetchで最終的に健全と判定される', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        let apiCallCount = 0;
        const { calls } = setFetch((url) => {
            if (isGithubUrl(url)) {
                return Promise.resolve(okJson([]));
            }
            apiCallCount += 1;
            if (apiCallCount === 1) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({}),
                });
            }
            return Promise.resolve(okJson({ status: 'ok' }));
        });

        await runUptimeCheck(['api']);

        const healthCalls = calls.filter((c) => !isGithubUrl(c.url));
        expect(healthCalls).toHaveLength(2);
        const createCalls = calls.filter(
            (c) => c.init?.method === 'POST' && isGithubUrl(c.url),
        );
        expect(createCalls).toHaveLength(0);
    });

    it('T-09: 3回とも500ならリトライ上限まで試行した後に不健全としてIssueが作成される', async () => {
        EnvStore.setEnv(FULL_ENV as never, []);
        const { calls } = setFetch((url, init) => {
            if (isGithubUrl(url)) {
                if (init?.method === 'POST') {
                    return Promise.resolve(okJson({ number: 77 }));
                }
                return Promise.resolve(okJson([]));
            }
            return Promise.resolve({
                ok: false,
                status: 500,
                json: () => Promise.resolve({}),
            });
        });

        await runUptimeCheck(['api']);

        const healthCalls = calls.filter((c) => !isGithubUrl(c.url));
        expect(healthCalls).toHaveLength(3);
        const createCalls = calls.filter(
            (c) => c.init?.method === 'POST' && isGithubUrl(c.url),
        );
        expect(createCalls).toHaveLength(1);
    });
});
