/**
 * GithubIssueGateway のテスト
 *
 * @spec なし
 *
 * CICD-125: 元は packages/api と packages/scraping に重複実装されていたものを
 * core へ集約した際に、両パッケージのテストケースを統合した
 * （api版: fetchAllOpenIssues/createIssue/addComment/closeIssue、
 *   scraping版: fetchAllOpenIssues/fetchIssueComments/createIssue/addComment）。
 *
 * ## デシジョンテーブル
 *
 * | #    | メソッド             | レスポンス                          | 期待挙動                                     |
 * |------|-----------------------|--------------------------------------|------------------------------------------------|
 * | T-01 | fetchAllOpenIssues    | 1ページ（3件、100件未満）            | 3件返し、fetchは1回のみ                        |
 * | T-02 | fetchAllOpenIssues    | 1ページ目100件・2ページ目1件          | 合計101件返し、fetchは2回                      |
 * | T-03 | fetchAllOpenIssues    | !ok（500）                            | 例外を投げる                                   |
 * | T-04 | fetchAllOpenIssues    | ok・スキーマ不正（number欠落）        | 例外を投げる（検証失敗メッセージ）              |
 * | T-05 | createIssue           | ok（number返却）                      | 作成されたIssue番号を返す                      |
 * | T-06 | createIssue           | !ok（422）                            | 例外を投げる                                   |
 * | T-07 | createIssue           | ok・スキーマ不正                      | 例外を投げる                                   |
 * | T-08 | addComment            | ok                                     | 例外を投げず完了                               |
 * | T-09 | addComment            | !ok（404）                            | 例外を投げる                                   |
 * | T-10 | closeIssue            | ok                                     | 例外を投げず完了                               |
 * | T-11 | closeIssue            | !ok（403）                            | 例外を投げる                                   |
 * | T-12 | (readErrorBody経路)   | !ok・response.text()が例外を投げる    | エラーメッセージに固定文言'(読み取り失敗)'を含む |
 * | T-13 | fetchIssueComments    | 1ページ（2件、100件未満）            | 2件のコメント本文を返し、fetchは1回のみ         |
 * | T-14 | fetchIssueComments    | !ok（500）                            | 例外を投げる                                   |
 * | T-15 | fetchIssueComments    | ok・スキーマ不正（body欠落）          | 例外を投げる（検証失敗メッセージ）              |
 * | T-16 | (userAgent反映)       | 任意のメソッド呼び出し                | fetchのheadersにコンストラクタで渡したuserAgentが含まれる |
 * | T-17 | (URL/ヘッダー組み立て) | fetchAllOpenIssues呼び出し           | URLがGITHUB_OWNER/GITHUB_REPO既定値(taichi6930/race-scheduler)を含み、state=open・per_page=100・page=1のクエリと全ヘッダー(Authorization/Accept/X-GitHub-Api-Version/Content-Type)が正しく組み立てられる |
 * | T-18 | fetchAllOpenIssues    | ページ番号に応じてレスポンスを返すfetch | 実際にリクエストされたpageクエリパラメータが1→2と正しくインクリメントされる（デクリメントされない） |
 * | T-19 | createIssue           | ok                                     | URL・method(POST)・bodyがtitle/bodyを含むJSONで正しく送信される |
 * | T-20 | addComment            | ok                                     | URL(.../issues/1/comments)・method(POST)・bodyがcommentを含むJSONで正しく送信される |
 * | T-21 | closeIssue            | ok                                     | URL(.../issues/1)・method(PATCH)・bodyがstate:'closed'のJSONで正しく送信される |
 * | T-22 | fetchIssueComments    | ok                                     | URLのper_page/pageクエリパラメータが正しく組み立てられる |
 */

import { afterEach, describe, expect, it, mock } from 'bun:test';

import { GithubIssueGateway } from '../../../src/gateway/githubIssueGateway';

interface FakeResponse {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
}

const okJson = (data: unknown): FakeResponse => ({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
});

const errRes = (status: number, body = 'error body'): FakeResponse => ({
    ok: false,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve({}),
});

const errResWithBrokenText = (status: number): FakeResponse => ({
    ok: false,
    status,
    text: () => Promise.reject(new Error('body read failed')),
    json: () => Promise.resolve({}),
});

interface FetchCall {
    url: string;
    init?: RequestInit;
}

const setFetch = (
    handler: (url: string, init?: RequestInit) => Promise<FakeResponse>,
): {
    callCount: number;
    lastInit?: RequestInit;
    lastUrl?: string;
    calls: FetchCall[];
} => {
    const state: {
        callCount: number;
        lastInit?: RequestInit;
        lastUrl?: string;
        calls: FetchCall[];
    } = {
        callCount: 0,
        calls: [],
    };
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
        state.callCount++;
        state.lastInit = init;
        state.lastUrl = url;
        state.calls.push({ url, init });
        return handler(url, init);
    }) as unknown as typeof globalThis.fetch;
    return state;
};

const issueSummary = (n: number) => ({ title: `issue-${n}`, number: n });

describe('GithubIssueGateway', () => {
    const gateway = new GithubIssueGateway('race-schedule-test');

    afterEach(() => {
        globalThis.fetch = undefined as unknown as typeof globalThis.fetch;
    });

    it('T-01: fetchAllOpenIssuesは100件未満のページで打ち切り1回のみfetchする', async () => {
        const state = setFetch(() =>
            Promise.resolve(
                okJson([issueSummary(1), issueSummary(2), issueSummary(3)]),
            ),
        );

        const result = await gateway.fetchAllOpenIssues('token');

        expect(result).toHaveLength(3);
        expect(state.callCount).toBe(1);
    });

    it('T-02: 1ページ目が100件ちょうどなら2ページ目も取得する', async () => {
        const page1 = Array.from({ length: 100 }, (_, i) => issueSummary(i));
        const page2 = [issueSummary(100)];
        // 実際にリクエストされたURLのpageクエリパラメータでページを切り替える
        // （呼び出し回数ではなく実際のpage値に基づく応答にすることで、
        // page++ の実装が壊れて誤ったページ番号を要求した場合にテストが失敗するようにする）
        setFetch((url) => {
            const page = new URL(url).searchParams.get('page');
            return Promise.resolve(okJson(page === '1' ? page1 : page2));
        });

        const result = await gateway.fetchAllOpenIssues('token');

        expect(result).toHaveLength(101);
    });

    it('T-18: fetchAllOpenIssuesはpageクエリを1→2の順に正しくインクリメントする', async () => {
        const page1 = Array.from({ length: 100 }, (_, i) => issueSummary(i));
        const page2 = [issueSummary(100)];
        const state = setFetch((url) => {
            const page = new URL(url).searchParams.get('page');
            return Promise.resolve(okJson(page === '1' ? page1 : page2));
        });

        await gateway.fetchAllOpenIssues('token');

        const requestedPages = state.calls.map((call) =>
            new URL(call.url).searchParams.get('page'),
        );
        expect(requestedPages).toEqual(['1', '2']);
    });

    it('T-03: fetchAllOpenIssuesは!okなら例外を投げる', async () => {
        setFetch(() => Promise.resolve(errRes(500)));

        await expect(gateway.fetchAllOpenIssues('token')).rejects.toThrow(
            'GitHub Issue 一覧取得失敗',
        );
    });

    it('T-04: fetchAllOpenIssuesはスキーマ不正なら例外を投げる', async () => {
        setFetch(() => Promise.resolve(okJson([{ title: 'no-number' }])));

        await expect(gateway.fetchAllOpenIssues('token')).rejects.toThrow(
            'GitHub Issue 一覧のレスポンス検証失敗',
        );
    });

    it('T-05: createIssueは作成されたIssue番号を返す', async () => {
        setFetch(() => Promise.resolve(okJson({ number: 123 })));

        const result = await gateway.createIssue('token', 'title', 'body');

        expect(result).toBe(123);
    });

    it('T-06: createIssueは!okなら例外を投げる', async () => {
        setFetch(() => Promise.resolve(errRes(422)));

        await expect(
            gateway.createIssue('token', 'title', 'body'),
        ).rejects.toThrow('Issue 作成失敗');
    });

    it('T-07: createIssueはスキーマ不正なら例外を投げる', async () => {
        setFetch(() => Promise.resolve(okJson({ notNumber: true })));

        await expect(
            gateway.createIssue('token', 'title', 'body'),
        ).rejects.toThrow('Issue 作成レスポンス検証失敗');
    });

    it('T-08: addCommentはokなら例外を投げず完了する', async () => {
        setFetch(() => Promise.resolve(okJson({})));

        await expect(
            gateway.addComment('token', 1, 'comment'),
        ).resolves.toBeUndefined();
    });

    it('T-09: addCommentは!okなら例外を投げる', async () => {
        setFetch(() => Promise.resolve(errRes(404)));

        await expect(gateway.addComment('token', 1, 'comment')).rejects.toThrow(
            'コメント追加失敗',
        );
    });

    it('T-10: closeIssueはokなら例外を投げず完了する', async () => {
        setFetch(() => Promise.resolve(okJson({})));

        await expect(gateway.closeIssue('token', 1)).resolves.toBeUndefined();
    });

    it('T-11: closeIssueは!okなら例外を投げる', async () => {
        setFetch(() => Promise.resolve(errRes(403)));

        await expect(gateway.closeIssue('token', 1)).rejects.toThrow(
            'Issue Close失敗',
        );
    });

    it('T-12: エラーボディの読み取り自体が失敗しても固定文言で例外を投げる', async () => {
        setFetch(() => Promise.resolve(errResWithBrokenText(500)));

        await expect(gateway.closeIssue('token', 1)).rejects.toThrow(
            '(読み取り失敗)',
        );
    });

    it('T-13: fetchIssueCommentsは100件未満のページで打ち切り1回のみfetchする', async () => {
        const state = setFetch(() =>
            Promise.resolve(
                okJson([{ body: 'comment-1' }, { body: 'comment-2' }]),
            ),
        );

        const result = await gateway.fetchIssueComments('token', 1);

        expect(result).toEqual(['comment-1', 'comment-2']);
        expect(state.callCount).toBe(1);
    });

    it('T-14: fetchIssueCommentsは!okなら例外を投げる', async () => {
        setFetch(() => Promise.resolve(errRes(500)));

        await expect(gateway.fetchIssueComments('token', 1)).rejects.toThrow(
            'GitHub Issue コメント一覧取得失敗',
        );
    });

    it('T-15: fetchIssueCommentsはスキーマ不正なら例外を投げる', async () => {
        setFetch(() => Promise.resolve(okJson([{ notBody: true }])));

        await expect(gateway.fetchIssueComments('token', 1)).rejects.toThrow(
            'GitHub Issue コメント一覧のレスポンス検証失敗',
        );
    });

    it('T-16: コンストラクタで渡したuserAgentがリクエストヘッダーに反映される', async () => {
        const state = setFetch(() => Promise.resolve(okJson([])));

        await gateway.fetchAllOpenIssues('token');

        const headers = state.lastInit?.headers as Record<string, string>;
        expect(headers['User-Agent']).toBe('race-schedule-test');
    });

    it('T-17: fetchAllOpenIssuesのURL・クエリ・全ヘッダーが正しく組み立てられる', async () => {
        const state = setFetch(() => Promise.resolve(okJson([])));

        await gateway.fetchAllOpenIssues('my-token');

        const url = new URL(state.lastUrl ?? '');
        // GITHUB_OWNER/GITHUB_REPO の既定値（taichi6930/race-scheduler）を含むことを検証
        expect(url.origin + url.pathname).toBe(
            'https://api.github.com/repos/taichi6930/race-scheduler/issues',
        );
        expect(url.searchParams.get('state')).toBe('open');
        expect(url.searchParams.get('per_page')).toBe('100');
        expect(url.searchParams.get('page')).toBe('1');

        const headers = state.lastInit?.headers as Record<string, string>;
        expect(headers).toEqual({
            Authorization: 'Bearer my-token',
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': 'race-schedule-test',
        });
    });

    it('T-19: createIssueはURL・method(POST)・bodyを正しく送信する', async () => {
        const state = setFetch(() => Promise.resolve(okJson({ number: 1 })));

        await gateway.createIssue('token', 'my-title', 'my-body');

        expect(state.lastUrl).toBe(
            'https://api.github.com/repos/taichi6930/race-scheduler/issues',
        );
        expect(state.lastInit?.method).toBe('POST');
        expect(state.lastInit?.body).toBe(
            JSON.stringify({ title: 'my-title', body: 'my-body' }),
        );
    });

    it('T-20: addCommentはURL・method(POST)・bodyを正しく送信する', async () => {
        const state = setFetch(() => Promise.resolve(okJson({})));

        await gateway.addComment('token', 42, 'my-comment');

        expect(state.lastUrl).toBe(
            'https://api.github.com/repos/taichi6930/race-scheduler/issues/42/comments',
        );
        expect(state.lastInit?.method).toBe('POST');
        expect(state.lastInit?.body).toBe(
            JSON.stringify({ body: 'my-comment' }),
        );
    });

    it('T-21: closeIssueはURL・method(PATCH)・bodyを正しく送信する', async () => {
        const state = setFetch(() => Promise.resolve(okJson({})));

        await gateway.closeIssue('token', 7);

        expect(state.lastUrl).toBe(
            'https://api.github.com/repos/taichi6930/race-scheduler/issues/7',
        );
        expect(state.lastInit?.method).toBe('PATCH');
        expect(state.lastInit?.body).toBe(JSON.stringify({ state: 'closed' }));
    });

    it('T-22: fetchIssueCommentsのURL・クエリパラメータが正しく組み立てられる', async () => {
        const state = setFetch(() => Promise.resolve(okJson([])));

        await gateway.fetchIssueComments('token', 99);

        const url = new URL(state.lastUrl ?? '');
        expect(url.origin + url.pathname).toBe(
            'https://api.github.com/repos/taichi6930/race-scheduler/issues/99/comments',
        );
        expect(url.searchParams.get('per_page')).toBe('100');
        expect(url.searchParams.get('page')).toBe('1');
    });
});
