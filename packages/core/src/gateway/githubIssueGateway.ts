/**
 * GitHub Issues REST API との通信の詳細（fetch・認証ヘッダー・ページング・
 * レスポンス検証）を担うゲートウェイ実装。
 *
 * CICD-125: 元は `packages/api` と `packages/scraping` に同一設計・ほぼ同一実装が
 * 重複していた（fine-grained PAT・Search API非対応のためIssues List APIで代替する等）。
 * `User-Agent` ヘッダーのみパッケージごとに異なっていたため、コンストラクタ引数
 * `userAgent` としてパラメータ化した上で `packages/core` へ集約した。
 * `core` は tsyringe に依存しない共有ライブラリのため `@injectable()` は付けない
 * （DIコンテナへの登録は利用側パッケージが `useFactory` で行う）。
 */

import z from 'zod';

import type {
    GithubIssueSummary,
    IGithubIssueGateway,
} from './IGithubIssueGateway';

/** GitHub Issue 一覧 API のレスポンス（必要なフィールドのみ）スキーマ */
const IssueListSchema = z.array(
    z.object({
        title: z.string(),
        number: z.number(),
    }),
);

/** GitHub Issue 作成 API のレスポンス（必要なフィールドのみ）スキーマ */
const CreatedIssueSchema = z.object({
    number: z.number(),
});

/** GitHub Issue コメント一覧 API のレスポンス（必要なフィールドのみ）スキーマ */
const IssueCommentListSchema = z.array(
    z.object({
        body: z.string(),
    }),
);

// フォーク運用に備え環境変数で上書き可能にする。
// 未設定時は本リポジトリ（race-scheduler）へフォールバックする。
// 2026-08-16のapi/batch/db/front/admin移行前は 'race-schedule' がデフォルトだったが、
// 移行後もこの値が残っていたため、batch Workflow失敗通知等が移行元リポジトリ
// （race-schedule）へ誤ってIssueを作成し続けていた（Issue #2549）。
const GITHUB_OWNER = process.env.GITHUB_OWNER ?? 'taichi6930';
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'race-scheduler';

/**
 * fetch レスポンスのエラーボディを安全に読み取る。
 * 読み取りに失敗しても例外を投げず固定文言を返す。
 * @param response - 対象のレスポンス
 * @returns レスポンスボディ文字列（読み取り失敗時は '(読み取り失敗)'）
 */
async function readErrorBody(response: Response): Promise<string> {
    try {
        return await response.text();
    } catch {
        return '(読み取り失敗)';
    }
}

/**
 * GitHub API を呼び出し、レスポンスが !ok なら固定フォーマットの例外を投げる。
 * @param url - リクエスト URL
 * @param init - fetch の初期化オプション
 * @param errorPrefix - 失敗時例外メッセージの接頭辞
 * @returns ok なレスポンス
 */
async function githubFetch(
    url: string,
    init: RequestInit,
    errorPrefix: string,
): Promise<Response> {
    const response = await fetch(url, init);
    if (!response.ok) {
        const errorBody = await readErrorBody(response);
        throw new Error(`${errorPrefix}: ${response.status} ${errorBody}`);
    }
    return response;
}

/**
 * Issue 一覧 API の URL（1ページ分、open状態・100件）を組み立てる。
 * @param page - 取得するページ番号
 */
function buildIssueListUrl(page: number): string {
    const listUrl = new URL(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
    );
    listUrl.searchParams.set('state', 'open');
    listUrl.searchParams.set('per_page', '100');
    listUrl.searchParams.set('page', String(page));
    return listUrl.href;
}

/**
 * オープンな Issue 一覧を1ページ分取得する。
 * @param page - 取得するページ番号
 * @param headers - GitHub API リクエストヘッダー
 */
async function fetchIssuePage(
    page: number,
    headers: Record<string, string>,
): Promise<GithubIssueSummary[]> {
    const listResponse = await githubFetch(
        buildIssueListUrl(page),
        { headers },
        'GitHub Issue 一覧取得失敗',
    );

    const parsed = IssueListSchema.safeParse(await listResponse.json());
    if (!parsed.success) {
        throw new Error(
            `GitHub Issue 一覧のレスポンス検証失敗: ${parsed.error.message}`,
        );
    }
    return parsed.data;
}

/**
 * Issue コメント一覧 API の URL（1ページ分・100件）を組み立てる。
 * @param issueNumber - 対象 Issue 番号
 * @param page - 取得するページ番号
 */
function buildIssueCommentsUrl(issueNumber: number, page: number): string {
    const url = new URL(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}/comments`,
    );
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    return url.href;
}

/**
 * Issue に投稿済みのコメント本文を1ページ分取得する。
 * @param issueNumber - 対象 Issue 番号
 * @param page - 取得するページ番号
 * @param headers - GitHub API リクエストヘッダー
 */
async function fetchCommentBodyPage(
    issueNumber: number,
    page: number,
    headers: Record<string, string>,
): Promise<string[]> {
    const response = await githubFetch(
        buildIssueCommentsUrl(issueNumber, page),
        { headers },
        'GitHub Issue コメント一覧取得失敗',
    );

    const parsed = IssueCommentListSchema.safeParse(await response.json());
    if (!parsed.success) {
        throw new Error(
            `GitHub Issue コメント一覧のレスポンス検証失敗: ${parsed.error.message}`,
        );
    }
    return parsed.data.map((comment) => comment.body);
}

/**
 * ページングされた GitHub API を全ページ分取得する（100件未満のページで終了）。
 * @param fetchPage - 1ページ分を取得する関数
 */
async function fetchAllPages<T>(
    fetchPage: (page: number) => Promise<T[]>,
): Promise<T[]> {
    const all: T[] = [];
    let page = 1;

    while (true) {
        const items = await fetchPage(page);
        all.push(...items);

        if (items.length < 100) {
            break;
        }
        page++;
    }

    return all;
}

/** GitHub Issues REST API との通信を担うゲートウェイ実装 */
export class GithubIssueGateway implements IGithubIssueGateway {
    /**
     * @param userAgent - リクエストヘッダーに付与する User-Agent。
     *   呼び出し元パッケージを識別できる値を渡す（例: 'race-schedule-api'）。
     */
    constructor(private readonly userAgent: string) {}

    /**
     * GitHub API 呼び出しに使うリクエストヘッダーを組み立てる。
     * @param token - GitHub API トークン
     */
    private buildHeaders(token: string) {
        return {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
        };
    }

    public async fetchAllOpenIssues(
        token: string,
    ): Promise<GithubIssueSummary[]> {
        const headers = this.buildHeaders(token);
        // NOTE: Fine-grained PAT は Search API 非対応のため Issues List API で代替
        return fetchAllPages((page) => fetchIssuePage(page, headers));
    }

    public async fetchIssueComments(
        token: string,
        issueNumber: number,
    ): Promise<string[]> {
        const headers = this.buildHeaders(token);
        return fetchAllPages((page) =>
            fetchCommentBodyPage(issueNumber, page, headers),
        );
    }

    public async createIssue(
        token: string,
        title: string,
        body: string,
    ): Promise<number> {
        const headers = this.buildHeaders(token);
        const response = await githubFetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({ title, body }),
            },
            'Issue 作成失敗',
        );

        const parsed = CreatedIssueSchema.safeParse(await response.json());
        if (!parsed.success) {
            throw new Error(
                `Issue 作成レスポンス検証失敗: ${parsed.error.message}`,
            );
        }
        return parsed.data.number;
    }

    public async addComment(
        token: string,
        issueNumber: number,
        body: string,
    ): Promise<void> {
        const headers = this.buildHeaders(token);
        await githubFetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}/comments`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({ body }),
            },
            'コメント追加失敗',
        );
    }

    public async closeIssue(token: string, issueNumber: number): Promise<void> {
        const headers = this.buildHeaders(token);
        await githubFetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`,
            {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ state: 'closed' }),
            },
            'Issue Close失敗',
        );
    }
}
