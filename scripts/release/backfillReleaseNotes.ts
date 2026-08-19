#!/usr/bin/env bun
/**
 * backfillReleaseNotes.ts
 *
 * race-schedule（private化予定）・race-scheduler 両リポジトリの既存GitHub Releasesを
 * release_note テーブルへ投入する `INSERT OR IGNORE` 文を生成する、一度きりのバックフィル
 * 用スクリプト。race-scheduleがprivateになると匿名フェッチでは過去リリース（v1.x）が
 * 参照できなくなるため、privateへ切り替える前に本スクリプトの出力をtest/production両方の
 * D1へ投入しておく必要がある。
 *
 * tag_name は両リポジトリで独立採番されており重複しうる（実例: 両方とも分割区切りとして
 * v2.0.0を採番している）ため、一意性は (tag_name, source_repo) の組で判定する
 * （0038_release_note.sqlite.sql の idx_release_note_tag_source に対応）。
 * `INSERT OR IGNORE` により、既に投入済みの行は再実行してもスキップされる（冪等）。
 *
 * 使い方:
 *   GITHUB_TOKEN=... bun scripts/release/backfillReleaseNotes.ts > backfill-release-notes.sql
 *
 *   # 生成したSQLを確認した上で、対象のD1へ投入する（packages/db から実行）
 *   wrangler d1 execute race_schedule_db_test --remote --env test \
 *     --config ./wrangler.toml --file=../../backfill-release-notes.sql
 *   bun run db:shell:production -- --file=../../backfill-release-notes.sql   # 本番（要確認プロンプト）
 */

import { githubHeaders } from './commitPrLookup';

const GITHUB_API_URL = 'https://api.github.com';

/** GitHub Releases API のレスポンス形状（本スクリプトが使うフィールドのみ）。 */
export interface GithubReleaseSource {
    tag_name: string;
    name: string | null;
    body: string | null;
    published_at: string | null;
    draft: boolean;
    prerelease: boolean;
}

interface FetchAllReleasesParams {
    githubToken: string;
    owner: string;
    repo: string;
}

/** 指定リポジトリの全リリース（draft・prerelease含む）をページネーションで取得する。 */
export const fetchAllReleases = async (
    params: FetchAllReleasesParams,
): Promise<GithubReleaseSource[]> => {
    const releases: GithubReleaseSource[] = [];
    for (let page = 1; ; page += 1) {
        const response = await fetch(
            `${GITHUB_API_URL}/repos/${params.owner}/${params.repo}/releases?per_page=100&page=${page}`,
            { headers: githubHeaders(params.githubToken) },
        );
        if (!response.ok) {
            throw new Error(
                `GitHub releases一覧の取得に失敗しました (${params.owner}/${params.repo}, HTTP ${response.status})`,
            );
        }
        const json: unknown = await response.json();
        if (!Array.isArray(json) || json.length === 0) {
            break;
        }
        releases.push(...(json as GithubReleaseSource[]));
        if (json.length < 100) {
            break;
        }
    }
    return releases;
};

/** SQLite文字列リテラルへ変換する（シングルクオートを二重化してエスケープ、nullはSQL NULL）。 */
export const sqlString = (value: string | null): string =>
    value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;

/**
 * 取得済みリリース一覧から release_note テーブルへの `INSERT OR IGNORE` 文を生成する。
 * (tag_name, source_repo) が一致する既存行はスキップされるため、複数回実行しても安全。
 */
export const buildInsertStatements = (
    releases: readonly (GithubReleaseSource & { sourceRepo: string })[],
): string =>
    releases
        .map(
            (r) =>
                `INSERT OR IGNORE INTO release_note (tag_name, name, body, published_at, draft, prerelease, source_repo) VALUES (${sqlString(r.tag_name)}, ${sqlString(r.name)}, ${sqlString(r.body)}, ${sqlString(r.published_at)}, ${r.draft ? 1 : 0}, ${r.prerelease ? 1 : 0}, ${sqlString(r.sourceRepo)});`,
        )
        .join('\n');

if (import.meta.main) {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        console.error('GITHUB_TOKEN が必要です。');
        process.exit(1);
    }

    const sources = [
        { owner: 'taichi6930', repo: 'race-schedule' },
        { owner: 'taichi6930', repo: 'race-scheduler' },
    ] as const;

    const allReleases: (GithubReleaseSource & { sourceRepo: string })[] = [];
    for (const source of sources) {
        try {
            const releases = await fetchAllReleases({ githubToken, ...source });
            allReleases.push(
                ...releases.map((r) => ({ ...r, sourceRepo: source.repo })),
            );
        } catch (error) {
            // 1リポジトリの取得失敗（例: privateリポジトリへのアクセス権不足）で
            // 他リポジトリ分まで巻き込んで全滅させない（部分成功を許容する）。
            console.error(
                `${source.owner}/${source.repo} のリリース取得に失敗したためスキップします: ${error}`,
            );
        }
    }

    console.log(buildInsertStatements(allReleases));
}
