/**
 * syncUptimeCheckIssue のテスト
 *
 * @spec なし（uptime-check.ymlのWorker側移行）
 *
 * ## デシジョンテーブル
 *
 * | #    | healthy | 既存Issue（タイトル一致） | 期待挙動                                   |
 * |------|---------|-----------------------------|---------------------------------------------|
 * | T-01 | true    | なし                        | 何もしない（正常、対象Issueもなし）         |
 * | T-02 | true    | あり                        | コメント追加 → Close                        |
 * | T-03 | false   | なし                        | 新規Issue作成（対象Workerのキーを含むタイトル） |
 * | T-04 | false   | あり                        | 既存Issueにコメント追加のみ（Closeしない）  |
 * | T-05 | -       | -（fetchAllOpenIssuesが例外）| catchされ、addComment/createIssueは呼ばれない |
 */

import { describe, expect, it, mock } from 'bun:test';
import type {
    GithubIssueSummary,
    IGithubIssueGateway,
} from '@race-schedule/core';

import { syncUptimeCheckIssue } from '../../../src/utility/uptimeCheckNotifier';

const buildGateway = (
    overrides: Partial<IGithubIssueGateway> = {},
): IGithubIssueGateway => ({
    fetchAllOpenIssues: mock(() => Promise.resolve<GithubIssueSummary[]>([])),
    fetchIssueComments: mock(() => Promise.resolve<string[]>([])),
    createIssue: mock(() => Promise.resolve(1)),
    addComment: mock(() => Promise.resolve()),
    closeIssue: mock(() => Promise.resolve()),
    ...overrides,
});

const baseResult = {
    targetKey: 'api',
    targetUrl: 'https://race-schedule-prod.tn-product.workers.dev/health',
};

const issueTitle = '[Uptime] api の /health 疎通に失敗';

describe('syncUptimeCheckIssue', () => {
    it('T-01: healthy=trueかつ既存Issueが無ければ何もしない', async () => {
        const gateway = buildGateway();

        await syncUptimeCheckIssue(
            { ...baseResult, healthy: true, httpStatus: 200 },
            gateway,
            'token',
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-02: healthy=trueかつ既存Issueがあればコメント追加後にCloseする', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([{ title: issueTitle, number: 42 }]),
            ),
        });

        await syncUptimeCheckIssue(
            { ...baseResult, healthy: true, httpStatus: 200 },
            gateway,
            'token',
        );

        expect(gateway.addComment).toHaveBeenCalledTimes(1);
        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            42,
            expect.stringContaining('疎通を確認できた'),
        );
        expect(gateway.closeIssue).toHaveBeenCalledWith('token', 42);
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-03: healthy=falseかつ既存Issueが無ければ新規作成する', async () => {
        const gateway = buildGateway();

        await syncUptimeCheckIssue(
            { ...baseResult, healthy: false, httpStatus: 500 },
            gateway,
            'token',
        );

        expect(gateway.createIssue).toHaveBeenCalledTimes(1);
        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            issueTitle,
            expect.stringContaining('500'),
        );
        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
    });

    it('T-04: healthy=falseかつ既存Issueがあればコメント追加のみでCloseしない', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([{ title: issueTitle, number: 7 }]),
            ),
        });

        await syncUptimeCheckIssue(
            { ...baseResult, healthy: false, httpStatus: 0 },
            gateway,
            'token',
        );

        expect(gateway.addComment).toHaveBeenCalledTimes(1);
        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            7,
            expect.stringContaining('0'),
        );
        expect(gateway.closeIssue).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-05: fetchAllOpenIssuesが例外を投げてもスローせずcatchされる', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.reject(new Error('network error')),
            ),
        });

        await syncUptimeCheckIssue(
            { ...baseResult, healthy: false, httpStatus: 500 },
            gateway,
            'token',
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });
});
