#!/usr/bin/env bun
/**
 * generateReleaseSummary.ts
 *
 * autoRelease.ts から呼び出される、リリースノート本文の生成スクリプト。
 *
 * 外部APIキー（Claude API等）は使わない方針のため、AI要約は行わない。代わりに、
 * PRを作成するエージェント（人間を含む）自身がPR本文にカテゴリ見出し付きの更新履歴を
 * 記載する運用とし（`.claude/docs/task-workflow.md` 参照）、このスクリプトは
 * 直前の実タグ以降にマージされた全PRの本文からその記載を集約するだけに徹する。
 *
 * 1. 直前の実タグ以降にマージされたPR番号一覧を取得する（commitPrLookup.ts）
 * 2. 各PRの本文から、releaseNoteCategories.tsの見出し規約に沿ったカテゴリ別箇条書きを
 *    抽出する（`parseCategorizedSections`）
 * 3. 該当セクションが無いPR（dependabot等、規約に従わないPR）は、PRタイトルを
 *    「その他」カテゴリのフォールバック項目として採用する（NFR-02: 情報を静かに失わない）
 * 4. 全PR分を5カテゴリへ集約し、Markdownへ整形する。各PRの`pkg:*`ラベル
 *    （`pull_request.yml`のdetect-changed-packagesジョブが変更パッケージから自動付与）から
 *    レイヤー名を取り出し、そのPR由来の箇条書き先頭に`[api]`のように付与する
 *    （ユーザー依頼、2026-08-05: 「どこで何の変更があったかわかるようにしたい」）
 * 5. GitHub純正の「## What's Changed」相当のPRリンク一覧＋Full Changelog比較リンクを
 *    末尾に付与する（ユーザー依頼、2026-08-02: 「開発での差分は記載しておいてほしい」）。
 *    front側の`release_note_parser.dart`は既知カテゴリ以外の`## `見出しに到達すると
 *    以降の箇条書きを収集しないため（[T-10]で検証済み）、front表示には混入しない。
 *
 * 標準出力にMarkdown本文を書き出す（手元での本文プレビュー確認用）。実運用では
 * autoRelease.ts が本モジュールの `generateReleaseSummary` 関数を直接importして使う。
 *
 * 使い方:
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo \
 *   bun scripts/release/generateReleaseSummary.ts > body.md
 */

import { isNonNullObject } from '../lib/typeGuards';
import { fetchMergedPrNumbersSinceTag, githubHeaders } from './commitPrLookup';
import { extractLayerLabels, formatLayerPrefix } from './packageLabels';
import {
    headingForCategory,
    RELEASE_NOTE_CATEGORY_KEYS,
} from './releaseNoteCategories';

const GITHUB_API_URL = 'https://api.github.com';
const NO_CHANGES_NOTICE = '(更新内容の記載はありません)';

interface PullRequestSummarySource {
    number: number;
    title: string;
    body: string;
    authorLogin: string;
    htmlUrl: string;
    /** `pkg:*` ラベルから抽出したレイヤー名一覧（detect-changed-packagesジョブが自動付与）。 */
    layerLabels: readonly string[];
}

interface CategorizedSummary {
    categories: { category: string; items: string[] }[];
}

interface PullRequestApiResponse {
    title: string;
    body?: string | null;
    user?: { login?: string } | null;
    html_url?: string;
    labels?: ({ name?: string | null } | null)[] | null;
}

const isPullRequestApiResponse = (
    value: unknown,
): value is PullRequestApiResponse =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { title?: unknown }).title === 'string' &&
    (typeof (value as { body?: unknown }).body === 'string' ||
        (value as { body?: unknown }).body === null ||
        (value as { body?: unknown }).body === undefined);

interface FetchLatestReleaseTagParams {
    githubToken: string;
    owner: string;
    repo: string;
}

/** 直前に公開された実タグ（draft・prereleaseを除く）の名前を取得する。無ければnull。 */
export const fetchLatestReleaseTag = async (
    params: FetchLatestReleaseTagParams,
): Promise<string | null> => {
    const response = await fetch(
        `${GITHUB_API_URL}/repos/${params.owner}/${params.repo}/releases?per_page=100`,
        { headers: githubHeaders(params.githubToken) },
    );
    if (!response.ok) {
        throw new Error(
            `GitHub releases一覧の取得に失敗しました (HTTP ${response.status})`,
        );
    }
    const releases: unknown = await response.json();
    if (!Array.isArray(releases)) {
        throw new Error(
            'GitHub releases一覧のレスポンス形式が想定と異なります',
        );
    }
    const latestPublished = releases.find(
        (r) =>
            isNonNullObject(r) &&
            (r as { draft?: unknown }).draft === false &&
            (r as { prerelease?: unknown }).prerelease === false,
    ) as { tag_name?: string } | undefined;
    return latestPublished?.tag_name ?? null;
};

/** PRのタイトル・本文を取得する。 */
const fetchPullRequestSummarySource = async (params: {
    githubToken: string;
    owner: string;
    repo: string;
    prNumber: number;
}): Promise<PullRequestSummarySource> => {
    const response = await fetch(
        `${GITHUB_API_URL}/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}`,
        { headers: githubHeaders(params.githubToken) },
    );
    if (!response.ok) {
        throw new Error(`PR情報の取得に失敗しました (HTTP ${response.status})`);
    }
    const json: unknown = await response.json();
    if (!isPullRequestApiResponse(json)) {
        throw new Error('PR情報のレスポンス形式が想定と異なります');
    }
    const labelNames = (json.labels ?? [])
        .map((label) => label?.name)
        .filter((name): name is string => typeof name === 'string');

    return {
        number: params.prNumber,
        title: json.title,
        body: json.body ?? '',
        // author/URLはWhat's Changed表示のみに使う付随情報のため、欠けていても
        // 例外にせずフォールバック値で埋める（NFR-02: 本体の集約処理を止めない）。
        authorLogin: json.user?.login ?? 'unknown',
        htmlUrl:
            json.html_url ??
            `https://github.com/${params.owner}/${params.repo}/pull/${params.prNumber}`,
        layerLabels: extractLayerLabels(labelNames),
    };
};

/**
 * PR本文から、releaseNoteCategories.tsの見出し規約に沿ったカテゴリ別箇条書きを抽出する。
 * 見出し規約に一致しないMarkdown（PRテンプレートの他セクション等）は無視する。
 * 頑健性（NFR-02）: 例外を投げず、該当箇所が無ければ空配列を返す。
 */
export const parseCategorizedSections = (
    body: string,
): { category: string; items: string[] }[] => {
    const headingToCategory = new Map(
        RELEASE_NOTE_CATEGORY_KEYS.map((key) => [headingForCategory(key), key]),
    );
    const sections: { category: string; items: string[] }[] = [];
    let current: { category: string; items: string[] } | null = null;

    for (const rawLine of body.split('\n')) {
        const line = rawLine.trim();
        const matchedCategory = headingToCategory.get(line);
        if (matchedCategory) {
            current = { category: matchedCategory, items: [] };
            sections.push(current);
            continue;
        }
        if (line.startsWith('## ')) {
            // 更新履歴カテゴリ以外の見出し（PRテンプレートの他セクション等）に入ったら終了
            current = null;
            continue;
        }
        if (current && line.startsWith('- ')) {
            current.items.push(line.slice(2).trim());
        }
    }
    return sections;
};

/**
 * 複数PRの更新履歴セクションを5カテゴリへ集約する。
 * カテゴリ見出しの記載が無いPR（dependabot等）は、PRタイトルを「その他」の
 * フォールバック項目として採用する（情報を静かに失わないため）。
 */
export const aggregateReleaseNotesFromPrs = (
    prs: readonly (Pick<PullRequestSummarySource, 'title' | 'body'> &
        Partial<Pick<PullRequestSummarySource, 'layerLabels'>>)[],
): CategorizedSummary => {
    const buckets = new Map<string, string[]>(
        RELEASE_NOTE_CATEGORY_KEYS.map((key) => [key, []]),
    );
    const fallbackKey =
        RELEASE_NOTE_CATEGORY_KEYS[RELEASE_NOTE_CATEGORY_KEYS.length - 1];

    for (const pr of prs) {
        const layerPrefix = formatLayerPrefix(pr.layerLabels ?? []);
        const sections = parseCategorizedSections(pr.body);
        if (sections.length === 0) {
            buckets.get(fallbackKey)?.push(`${layerPrefix}${pr.title}`);
            continue;
        }
        for (const section of sections) {
            const bucket =
                buckets.get(section.category) ?? buckets.get(fallbackKey);
            bucket?.push(
                ...section.items.map((item) => `${layerPrefix}${item}`),
            );
        }
    }

    return {
        categories: RELEASE_NOTE_CATEGORY_KEYS.map((key) => ({
            category: key,
            items: buckets.get(key) ?? [],
        })),
    };
};

/** カテゴリ分類済みの要約を、front側のパース規約に沿ったMarkdownへ整形する。 */
export const buildMarkdownFromSummary = (summary: CategorizedSummary): string =>
    summary.categories
        .filter((c) => c.items.length > 0)
        .map(
            (c) =>
                `${headingForCategory(c.category)}\n${c.items.map((item) => `- ${item}`).join('\n')}`,
        )
        .join('\n\n');

/**
 * GitHub純正の「## What's Changed」相当のセクションを組み立てる。
 * 各PRへのリンク一覧＋直前の実タグ以降の差分を見るFull Changelog比較リンクを含む
 * （ユーザー依頼、2026-08-02: 「開発での差分は記載しておいてほしい」）。
 *
 * 比較先は`main`ブランチではなく今回作成するタグ（`nextVersion`）にする。
 * `main`比較だと後続コミットが積まれるたびにリンクの差分内容が変化してしまい、
 * 「このリリースで何が変わったか」を指す固定リンクにならないため
 * （ユーザー指摘、2026-08-05）。GitHub純正の「Generate release notes」機能も
 * 前回タグ...今回タグの形式で比較する。
 *
 * front側の`release_note_parser.dart`は既知の5カテゴリ以外の`## `見出しに到達すると
 * それ以降の箇条書きの収集を止める設計のため（`[T-10]`規約と同一）、この関数が返す
 * `## What's Changed`セクションはfront側のカテゴリ表示には混入しない。
 */
export const buildWhatsChangedMarkdown = (params: {
    owner: string;
    repo: string;
    prs: readonly Pick<
        PullRequestSummarySource,
        'title' | 'authorLogin' | 'htmlUrl'
    >[];
    lastTag: string | null;
    nextVersion: string;
}): string => {
    if (params.prs.length === 0) {
        return '';
    }
    const items = params.prs
        .map((pr) => `* ${pr.title} by @${pr.authorLogin} in ${pr.htmlUrl}`)
        .join('\n');
    const compareLine = params.lastTag
        ? `\n\n**Full Changelog**: https://github.com/${params.owner}/${params.repo}/compare/${params.lastTag}...${params.nextVersion}`
        : '';
    return `## What's Changed\n${items}${compareLine}`;
};

interface GenerateReleaseSummaryParams {
    githubToken: string;
    owner: string;
    repo: string;
    /**
     * Full Changelogリンクの比較先。省略時は`main`（手元プレビュー等、次バージョンが
     * 未確定の呼び出し向けのフォールバック）。実運用のautoRelease.tsは確定済みの
     * 次バージョンタグを渡す。
     */
    nextVersion?: string;
}

/**
 * 直前の実タグ以降にマージされた全PRの本文から、リリースノート本文を生成する。
 * 本文はカテゴリ別更新履歴（front表示用）＋What's Changed（開発差分の参照用、
 * front側では無視される）の2部構成。
 */
export const generateReleaseSummary = async (
    params: GenerateReleaseSummaryParams,
): Promise<string> => {
    const lastTag = await fetchLatestReleaseTag(params);
    const { prNumbers } = await fetchMergedPrNumbersSinceTag({
        ...params,
        lastTag,
    });
    const prs = await Promise.all(
        prNumbers.map((prNumber) =>
            fetchPullRequestSummarySource({ ...params, prNumber }),
        ),
    );
    const categorizedMarkdown = buildMarkdownFromSummary(
        aggregateReleaseNotesFromPrs(prs),
    );
    const whatsChangedMarkdown = buildWhatsChangedMarkdown({
        owner: params.owner,
        repo: params.repo,
        prs,
        lastTag,
        nextVersion: params.nextVersion ?? 'main',
    });

    const sections = [categorizedMarkdown, whatsChangedMarkdown].filter(
        (s) => s.trim().length > 0,
    );
    return sections.length > 0
        ? sections.join('\n\n---\n\n')
        : NO_CHANGES_NOTICE;
};

if (import.meta.main) {
    const githubToken = process.env.GITHUB_TOKEN;
    const repository = process.env.GITHUB_REPOSITORY;
    if (!githubToken || !repository) {
        console.error('GITHUB_TOKEN / GITHUB_REPOSITORY が必要です。');
        process.exit(1);
    }
    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
        console.error(`GITHUB_REPOSITORY の形式が不正です: ${repository}`);
        process.exit(1);
    }

    const body = await generateReleaseSummary({ githubToken, owner, repo });
    console.log(body);
}
