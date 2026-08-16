/** GitHub Issue（一覧取得時に必要なフィールドのみ） */
export interface GithubIssueSummary {
    title: string;
    number: number;
}

/**
 * GitHub Issues REST API との通信を担うゲートウェイ。
 *
 * `packages/api`（データ鮮度チェック、CICD-121）と `packages/scraping`
 * （未対応ステージ検出のマスター Issue 集約）の双方で使われる共通実装
 * （CICD-125: 元は各パッケージに重複実装されていたものを集約）。
 */
export interface IGithubIssueGateway {
    /**
     * オープンな Issue の一覧を全ページ取得する。
     * @param token - GitHub API トークン
     */
    fetchAllOpenIssues(token: string): Promise<GithubIssueSummary[]>;

    /**
     * Issue に投稿済みのコメント本文を全ページ取得する。
     * 既知の検出内容（重複判定キー）をコメント履歴から読み取るために使う。
     * @param token - GitHub API トークン
     * @param issueNumber - 対象 Issue 番号
     */
    fetchIssueComments(token: string, issueNumber: number): Promise<string[]>;

    /**
     * Issue を新規作成する。
     * @param token - GitHub API トークン
     * @param title - Issue タイトル
     * @param body - Issue 本文
     * @returns 作成された Issue 番号
     */
    createIssue(token: string, title: string, body: string): Promise<number>;

    /**
     * Issue にコメントを追加する。
     * @param token - GitHub API トークン
     * @param issueNumber - コメント追加先の Issue 番号
     * @param body - コメント本文
     */
    addComment(token: string, issueNumber: number, body: string): Promise<void>;

    /**
     * Issue をCloseする。
     * @param token - GitHub API トークン
     * @param issueNumber - Close対象の Issue 番号
     */
    closeIssue(token: string, issueNumber: number): Promise<void>;
}
