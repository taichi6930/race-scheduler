/**
 * commitPrLookup.ts
 *
 * コミット履歴からPR番号を特定するための共通ヘルパー。
 * generateReleaseSummary.ts（リリースノート集約）とautoRelease.ts（自動リリース判定）の
 * 両方が「直前の実タグ以降にマージされたPR一覧」を必要とするため、ここに集約する。
 *
 * このリポジトリはPRのsquash mergeを前提としており、GitHubは既定でコミットメッセージの
 * 先頭行末尾に `(#NNNN)` を自動付与する（`git log --oneline` で確認済み）。
 */

const GITHUB_API_URL = 'https://api.github.com';

export const githubHeaders = (githubToken: string) => ({
    authorization: `Bearer ${githubToken}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
});

/**
 * PRのsemver:*ラベル（none/patch/minor/major）を取得する。無ければundefined。
 * autoRelease.ts（自動リリース可否判定）が使う。
 */
export const fetchPrSemverLevel = async (params: {
    githubToken: string;
    owner: string;
    repo: string;
    prNumber: number;
}): Promise<string | undefined> => {
    const response = await fetch(
        `${GITHUB_API_URL}/repos/${params.owner}/${params.repo}/issues/${params.prNumber}/labels`,
        { headers: githubHeaders(params.githubToken) },
    );
    if (!response.ok) {
        return undefined;
    }
    const json: unknown = await response.json();
    if (!Array.isArray(json)) {
        return undefined;
    }
    const names = json
        .map((entry) =>
            typeof entry === 'object' && entry !== null
                ? (entry as { name?: unknown }).name
                : undefined,
        )
        .filter((name): name is string => typeof name === 'string');
    const semverLabel = names.find((name) => name.startsWith('semver:'));
    if (semverLabel) {
        return semverLabel.replace('semver:', '');
    }
    // dependabotのPRは pr-gates.yml（旧check-semver-label.yml）のチェック対象外（ci-conventions.md参照）で
    // semver:*ラベルが付与されない。ラベル未設定を「未確認」扱いのまま自動リリース判定に
    // 回すと、dependabotのPRが1件マージされるだけで以降の自動リリースが恒久的に
    // 見送られ続けてしまう。依存パッチ更新はユーザー影響が軽微なため、安全側でpatch扱いとする。
    if (names.includes('dependabot')) {
        return 'patch';
    }
    return undefined;
};

/** squash mergeコミットメッセージの先頭行末尾 `(#NNNN)` からPR番号を抽出する。無ければnull。 */
export const extractPrNumberFromCommitMessage = (
    message: string,
): number | null => {
    const firstLine = message.split('\n')[0] ?? '';
    const match = firstLine.match(/\(#(\d+)\)\s*$/);
    return match ? Number.parseInt(match[1], 10) : null;
};

interface CompareCommit {
    commit: { message: string };
}

/** 直前の実タグ以降、mainにマージされたコミットのメッセージ一覧を取得する。 */
export const fetchCommitMessagesSinceTag = async (params: {
    githubToken: string;
    owner: string;
    repo: string;
    lastTag: string;
}): Promise<string[]> => {
    const response = await fetch(
        `${GITHUB_API_URL}/repos/${params.owner}/${params.repo}/compare/${encodeURIComponent(params.lastTag)}...main`,
        { headers: githubHeaders(params.githubToken) },
    );
    if (!response.ok) {
        throw new Error(
            `compare APIの呼び出しに失敗しました (HTTP ${response.status})`,
        );
    }
    const json: unknown = await response.json();
    const commits = (json as { commits?: unknown }).commits;
    if (!Array.isArray(commits)) {
        throw new Error('compare APIのレスポンス形式が想定と異なります');
    }
    return (commits as CompareCommit[]).map((c) => c.commit.message);
};

/**
 * 直前の実タグ以降にマージされたPR番号一覧を取得する。PR番号を特定できないコミット
 * （直接pushされたコミット等）が何件あったかも返す（呼び出し側の安全側判定に使う）。
 */
export const fetchMergedPrNumbersSinceTag = async (params: {
    githubToken: string;
    owner: string;
    repo: string;
    lastTag: string | null;
}): Promise<{ prNumbers: number[]; unresolvedCommitCount: number }> => {
    if (!params.lastTag) {
        return { prNumbers: [], unresolvedCommitCount: 0 };
    }
    const messages = await fetchCommitMessagesSinceTag({
        ...params,
        lastTag: params.lastTag,
    });
    const prNumbers: number[] = [];
    let unresolvedCommitCount = 0;
    for (const message of messages) {
        const prNumber = extractPrNumberFromCommitMessage(message);
        if (prNumber === null) {
            unresolvedCommitCount += 1;
        } else {
            prNumbers.push(prNumber);
        }
    }
    return { prNumbers, unresolvedCommitCount };
};
