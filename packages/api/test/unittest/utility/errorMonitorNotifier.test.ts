/**
 * syncErrorMonitorIssue のテスト
 *
 * @spec なし（CICD-122: error-monitor.ymlのWorker側移行）
 *
 * ## デシジョンテーブル
 *
 * | #    | errorCount | 既存Issue（タイトル一致） | 期待挙動                                   |
 * |------|-----------|----------------------------|---------------------------------------------|
 * | T-01 | 0         | なし                        | 何もしない（正常、対象Issueもなし）         |
 * | T-02 | 0         | あり                        | コメント追加 → Close                        |
 * | T-03 | >0        | なし                        | 新規Issue作成（対象Workerのscript名を含むタイトル） |
 * | T-04 | >0        | あり                        | 既存Issueにコメント追加のみ（Closeしない）  |
 * | T-05 | -         | -（fetchAllOpenIssuesが例外）| catchされ、addComment/createIssueは呼ばれない |
 */

import { describe, expect, it, mock } from 'bun:test';
import type {
    GithubIssueSummary,
    IGithubIssueGateway,
} from '@race-schedule/core';

import { syncErrorMonitorIssue } from '../../../src/utility/errorMonitorNotifier';

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
    scriptName: 'race-schedule-prod',
    windowStartIso: '2026-08-05T00:00:00.000Z',
    windowEndIso: '2026-08-05T01:00:00.000Z',
};

const issueTitle = '[Cloudflare] race-schedule-prod でエラーを検知';

describe('syncErrorMonitorIssue', () => {
    it('T-01: errorCount0かつ既存Issueが無ければ何もしない', async () => {
        const gateway = buildGateway();

        await syncErrorMonitorIssue(
            { ...baseResult, errorCount: 0, requestCount: 100 },
            gateway,
            'token',
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-02: errorCount0かつ既存Issueがあればコメント追加後にCloseする', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([{ title: issueTitle, number: 42 }]),
            ),
        });

        await syncErrorMonitorIssue(
            { ...baseResult, errorCount: 0, requestCount: 100 },
            gateway,
            'token',
        );

        expect(gateway.addComment).toHaveBeenCalledTimes(1);
        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            42,
            expect.stringContaining('エラーが検知されなかった'),
        );
        expect(gateway.closeIssue).toHaveBeenCalledWith('token', 42);
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-03: errorCountが1以上かつ既存Issueが無ければ新規作成する', async () => {
        const gateway = buildGateway();

        await syncErrorMonitorIssue(
            { ...baseResult, errorCount: 3, requestCount: 100 },
            gateway,
            'token',
        );

        expect(gateway.createIssue).toHaveBeenCalledTimes(1);
        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            issueTitle,
            expect.stringContaining('race-schedule-prod'),
        );
        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
    });

    it('T-04: errorCountが1以上かつ既存Issueがあればコメント追加のみでCloseしない', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([{ title: issueTitle, number: 7 }]),
            ),
        });

        await syncErrorMonitorIssue(
            { ...baseResult, errorCount: 3, requestCount: 100 },
            gateway,
            'token',
        );

        expect(gateway.addComment).toHaveBeenCalledTimes(1);
        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            7,
            expect.stringContaining('race-schedule-prod'),
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

        await syncErrorMonitorIssue(
            { ...baseResult, errorCount: 3, requestCount: 100 },
            gateway,
            'token',
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });
});
