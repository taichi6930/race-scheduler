/**
 * syncDataFreshnessIssue のテスト
 *
 * @spec なし（CICD-121: health-check-data-freshness.ymlのWorker側移行）
 *
 * ## デシジョンテーブル
 *
 * | #    | raceCount | 既存Issue（タイトル一致） | 期待挙動                                   |
 * |------|-----------|----------------------------|---------------------------------------------|
 * | T-01 | >0        | なし                        | 何もしない（正常、対象Issueもなし）         |
 * | T-02 | >0        | あり                        | コメント追加 → Close                        |
 * | T-03 | 0         | なし                        | 新規Issue作成                               |
 * | T-04 | 0         | あり                        | 既存Issueにコメント追加のみ（Closeしない）  |
 * | T-05 | -         | -（fetchAllOpenIssuesが例外）| catchされ、addComment/createIssueは呼ばれない |
 */

import { describe, expect, it, mock } from 'bun:test';
import type {
    GithubIssueSummary,
    IGithubIssueGateway,
} from '@race-schedule/core';

import {
    DATA_FRESHNESS_ISSUE_TITLE,
    syncDataFreshnessIssue,
} from '../../../src/utility/dataFreshnessNotifier';

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

describe('syncDataFreshnessIssue', () => {
    it('T-01: raceCount>0かつ既存Issueが無ければ何もしない', async () => {
        const gateway = buildGateway();

        await syncDataFreshnessIssue(
            { checkDateJst: '2026-08-01', raceCount: 5 },
            gateway,
            'token',
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-02: raceCount>0かつ既存Issueがあればコメント追加後にCloseする', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([
                    { title: DATA_FRESHNESS_ISSUE_TITLE, number: 42 },
                ]),
            ),
        });

        await syncDataFreshnessIssue(
            { checkDateJst: '2026-08-01', raceCount: 5 },
            gateway,
            'token',
        );

        expect(gateway.addComment).toHaveBeenCalledTimes(1);
        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            42,
            expect.stringContaining('5 件'),
        );
        expect(gateway.closeIssue).toHaveBeenCalledWith('token', 42);
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-03: raceCountが0かつ既存Issueが無ければ新規作成する', async () => {
        const gateway = buildGateway();

        await syncDataFreshnessIssue(
            { checkDateJst: '2026-08-01', raceCount: 0 },
            gateway,
            'token',
        );

        expect(gateway.createIssue).toHaveBeenCalledTimes(1);
        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            DATA_FRESHNESS_ISSUE_TITLE,
            expect.stringContaining('0件'),
        );
        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
    });

    it('T-04: raceCountが0かつ既存Issueがあればコメント追加のみでCloseしない', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([
                    { title: DATA_FRESHNESS_ISSUE_TITLE, number: 7 },
                ]),
            ),
        });

        await syncDataFreshnessIssue(
            { checkDateJst: '2026-08-01', raceCount: 0 },
            gateway,
            'token',
        );

        expect(gateway.addComment).toHaveBeenCalledTimes(1);
        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            7,
            expect.stringContaining('0件'),
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

        await syncDataFreshnessIssue(
            { checkDateJst: '2026-08-01', raceCount: 0 },
            gateway,
            'token',
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });
});
