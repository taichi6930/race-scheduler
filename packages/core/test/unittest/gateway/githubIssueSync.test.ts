/**
 * syncGithubIssueByCondition のテスト
 *
 * @spec なし
 *
 * @remarks QRUN-01: 元は packages/api/src/utility/githubIssueSync.ts にあり、
 *   api の4つの通知ロジック（dataFreshnessNotifier等）のテストを通じて間接的に
 *   カバーされていたが、core へ移設したことに伴い直接のテストを追加した。
 *
 * ## デシジョンテーブル
 *
 * | #    | isRecovered | 既存Issue（タイトル一致） | 期待挙動                                   |
 * |------|-------------|-----------------------------|---------------------------------------------|
 * | T-01 | true        | なし                         | 何もしない（対象Issueもなし）               |
 * | T-02 | true        | あり                         | 復旧コメント追加 → Close                    |
 * | T-03 | false       | なし                         | 新規Issue作成                               |
 * | T-04 | false       | あり                         | 既存Issueにコメント追加のみ（Closeしない）  |
 * | T-05 | -           | -（fetchAllOpenIssuesが例外） | catchされ、addComment/createIssueは呼ばれない |
 */

import { describe, expect, it, mock } from 'bun:test';
import { syncGithubIssueByCondition } from '../../../src/gateway/githubIssueSync';
import type {
    GithubIssueSummary,
    IGithubIssueGateway,
} from '../../../src/gateway/IGithubIssueGateway';

const ISSUE_TITLE = '[Test] サンプル監視Issue';

interface CheckResult {
    recovered: boolean;
}

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

const handlers = {
    logPrefix: '[test]',
    title: () => ISSUE_TITLE,
    isRecovered: (r: CheckResult) => r.recovered,
    keyPrefix: () => '',
    noOpReason: () => '正常',
    recoveredReason: () => '復旧し',
    buildAlertBody: () => 'alert body',
    buildRecoveryComment: () => 'recovery comment',
};

describe('syncGithubIssueByCondition', () => {
    it('T-01: 復旧かつ既存Issueが無ければ何もしない', async () => {
        const gateway = buildGateway();

        await syncGithubIssueByCondition(
            { recovered: true },
            gateway,
            'token',
            handlers,
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-02: 復旧かつ既存Issueがあればコメント追加後にCloseする', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([{ title: ISSUE_TITLE, number: 42 }]),
            ),
        });

        await syncGithubIssueByCondition(
            { recovered: true },
            gateway,
            'token',
            handlers,
        );

        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            42,
            'recovery comment',
        );
        expect(gateway.closeIssue).toHaveBeenCalledWith('token', 42);
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });

    it('T-03: 異常かつ既存Issueが無ければ新規作成する', async () => {
        const gateway = buildGateway();

        await syncGithubIssueByCondition(
            { recovered: false },
            gateway,
            'token',
            handlers,
        );

        expect(gateway.createIssue).toHaveBeenCalledWith(
            'token',
            ISSUE_TITLE,
            'alert body',
        );
        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.closeIssue).not.toHaveBeenCalled();
    });

    it('T-04: 異常かつ既存Issueがあればコメント追加のみでCloseしない', async () => {
        const gateway = buildGateway({
            fetchAllOpenIssues: mock(() =>
                Promise.resolve([{ title: ISSUE_TITLE, number: 7 }]),
            ),
        });

        await syncGithubIssueByCondition(
            { recovered: false },
            gateway,
            'token',
            handlers,
        );

        expect(gateway.addComment).toHaveBeenCalledWith(
            'token',
            7,
            'alert body',
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

        await syncGithubIssueByCondition(
            { recovered: false },
            gateway,
            'token',
            handlers,
        );

        expect(gateway.addComment).not.toHaveBeenCalled();
        expect(gateway.createIssue).not.toHaveBeenCalled();
    });
});
