/**
 * syncBatchWorkflowFailureIssue のテスト
 *
 * ## デシジョンテーブル
 *
 * | #    | failures  | 既存Issue（タイトル一致） | 期待挙動                                     |
 * |------|-----------|----------------------------|-----------------------------------------------|
 * | T-01a | 空配列（成功） | なし                   | 何もしない（addComment/closeIssueも呼ばれない）（QRUN-01） |
 * | T-01b | 空配列（成功） | あり                   | 復旧コメント追加 → Close（QRUN-01）           |
 * | T-02 | 1件以上   | なし                        | 新規Issue作成                                 |
 * | T-03 | 1件以上   | あり                        | 既存Issueにコメント追加のみ（新規作成しない） |
 * | T-04 | 1件以上   | -（fetchAllOpenIssuesが例外）| catchされ、addComment/createIssueは呼ばれない |
 * | T-05 | 1件以上（Errorでない値） | なし         | describeErrorがString(error)にフォールバックする |
 * | T-06 | 1件以上   | なし                        | Cloudflare Workers LogsへのリンクURLとinstanceIdが本文に含まれる（QRUN-05） |
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';
import type {
    GithubIssueSummary,
    IGithubIssueGateway,
} from '@race-schedule/core';
import { EnvStore, RaceType } from '@race-schedule/core';

import {
    BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
    type BatchStepFailure,
    syncBatchWorkflowFailureIssue,
} from '../../../src/workflows/notifyBatchWorkflowFailure';

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

const oneFailure: BatchStepFailure[] = [
    { raceType: RaceType.NAR, target: 'race', error: new Error('boom') },
];

describe('syncBatchWorkflowFailureIssue', () => {
    afterEach(() => {
        EnvStore.reset();
    });

    it('T-01a: failuresが空配列(成功)かつ既存Issueが無ければ何もしない', async () => {
        const gateway = buildGateway();

        await syncBatchWorkflowFailureIssue([], 'instance-1', gateway, 'token');

        expect(gateway.fetchAllOpenIssues).toHaveBeenCalledTimes(1);
        expect(gateway.createIssue).not.toHaveBeenCalled();
        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
    });

    it('T-01b: failuresが空配列(成功)かつ既存Issueがあればコメント追加後にCloseする(QRUN-01)', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([
                    { title: BATCH_WORKFLOW_FAILURE_ISSUE_TITLE, number: 55 },
                ]),
            ),
        });

        await syncBatchWorkflowFailureIssue([], 'instance-1', gateway, 'token');

        expect(gateway.addComment).toHaveBeenCalledTimes(1);
        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            55,
            expect.stringContaining('失敗なしで完了'),
        );
        expect(gateway.closeIssue).toHaveBeenCalledWith('token', 55);
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-02: failuresがあり既存Issueが無ければ新規作成する', async () => {
        const gateway = buildGateway();

        await syncBatchWorkflowFailureIssue(
            oneFailure,
            'instance-1',
            gateway,
            'token',
        );

        expect(gateway.createIssue).toHaveBeenCalledTimes(1);
        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
            expect.stringContaining('nar-race'),
        );
        expect(gateway.addComment).not.toHaveBeenCalled();
    });

    it('T-03: failuresがあり既存Issueがあればコメント追加のみで新規作成しない', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([
                    { title: BATCH_WORKFLOW_FAILURE_ISSUE_TITLE, number: 99 },
                ]),
            ),
        });

        await syncBatchWorkflowFailureIssue(
            oneFailure,
            'instance-1',
            gateway,
            'token',
        );

        expect(gateway.addComment).toHaveBeenCalledTimes(1);
        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            99,
            expect.stringContaining('instance-1'),
        );
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-04: fetchAllOpenIssuesが例外を投げてもスローせずcatchされる', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.reject(new Error('network error')),
            ),
        });

        await syncBatchWorkflowFailureIssue(
            oneFailure,
            'instance-1',
            gateway,
            'token',
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-05: Errorでない値がerrorに入っていてもString化されて本文に含まれる', async () => {
        const gateway = buildGateway();
        const failures: BatchStepFailure[] = [
            { raceType: RaceType.JRA, target: 'place', error: 'string-error' },
        ];

        await syncBatchWorkflowFailureIssue(
            failures,
            'instance-1',
            gateway,
            'token',
        );

        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
            expect.stringContaining('string-error'),
        );
    });

    it('T-06: CLOUDFLARE_ACCOUNT_ID未設定時はアカウントIDを含まないWorkers LogsのURLとinstanceIdが本文に含まれる', async () => {
        const gateway = buildGateway();

        await syncBatchWorkflowFailureIssue(
            oneFailure,
            'instance-42',
            gateway,
            'token',
        );

        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
            expect.stringContaining(
                'https://dash.cloudflare.com/workers/services/view/race-schedule-batch-prod/production/observability/logs',
            ),
        );
        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
            expect.stringContaining(
                'インスタンス ID `instance-42` でログを検索',
            ),
        );
    });

    it('T-06b: CLOUDFLARE_ACCOUNT_ID設定時はアカウントIDを含むWorkers LogsのURLが本文に含まれる', async () => {
        EnvStore.setEnv(
            { CLOUDFLARE_ACCOUNT_ID: 'cf-account-123' } as never,
            [],
        );
        const gateway = buildGateway();

        await syncBatchWorkflowFailureIssue(
            oneFailure,
            'instance-1',
            gateway,
            'token',
        );

        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            BATCH_WORKFLOW_FAILURE_ISSUE_TITLE,
            expect.stringContaining(
                'https://dash.cloudflare.com/cf-account-123/workers/services/view/race-schedule-batch-prod/production/observability/logs',
            ),
        );
    });
});
