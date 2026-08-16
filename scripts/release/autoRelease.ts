#!/usr/bin/env bun
/**
 * autoRelease.ts
 *
 * deploy.yml の post-merge-verify（sIT+UAT smoke）成功後に呼び出される、
 * patch/minor限定の自動タグ作成・自動リリーススクリプト（auto-semver-release-requirements.md）。
 *
 * 1. 直前の実タグ以降にマージされた全PRを、コミットメッセージの `(#NNNN)` サフィックス
 *    （squash merge時にGitHubが自動付与）から特定する（commitPrLookup.ts）
 * 2. 各PRの `semver:none` / `semver:patch` / `semver:minor` / `semver:major` ラベルを
 *    確認する（PRを作成するエージェント自身が付与する。`.claude/docs/task-workflow.md` 参照）
 * 3. `semver:none`（ドキュメントのみ・リリース不要）のPRをリリース対象から除外した上で、
 *    残った全PRが `semver:patch` / `semver:minor` の場合のみ、次のバージョン
 *    （`semver:minor` が1件でもあればminorバンプ、無ければpatchバンプ）で実タグ・実Releaseを
 *    自動作成する（本文はgenerateReleaseSummary.tsが各PR本文の更新履歴セクションから
 *    集約する。外部APIキーは使わない）。`semver:none` のPRだけしか無い場合はバージョンを
 *    変更しない
 * 4. 除外後に1件でもmajor・ラベル未設定・PR番号を特定できないコミットが含まれる場合は
 *    何もしない（現状どおり人間の手動publish待ち。majorは常に要確認）
 *
 * Kill Switch（vars.AUTO_RELEASE_ENABLED）の判定はワークフロー側のジョブ`if`で行う
 * （このスクリプトは呼ばれた時点で常に実行する）。
 *
 * 使い方:
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo bun scripts/release/autoRelease.ts
 */

import {
    fetchMergedPrNumbersSinceTag,
    fetchPrSemverLevel,
    githubHeaders,
} from './commitPrLookup';
import {
    fetchLatestReleaseTag,
    generateReleaseSummary,
} from './generateReleaseSummary';

const GITHUB_API_URL = 'https://api.github.com';

const buildAutoReleaseNotice = (bumpLevel: ReleaseBumpLevel): string =>
    bumpLevel === 'minor'
        ? '> 🤖 このリリースはminor（後方互換の新機能追加）までの変更のため自動作成されました\n\n'
        : '> 🤖 このリリースはpatchのみの変更のため自動作成されました\n\n';

/** 自動リリースが対象とするバンプの大きさ。majorは常に人間の手動publish待ち。 */
export type ReleaseBumpLevel = 'patch' | 'minor';

export interface AutoReleaseEligibility {
    eligible: boolean;
    reason: string;
    bumpLevel?: ReleaseBumpLevel;
}

/**
 * PR番号ごとのsemverラベル（無ければundefined）から、自動リリース可否を判定する。
 * 'none'（ドキュメントのみ・リリース不要）のPRはリリース対象から除外した上で判定する。
 * 除外後に残った全PRが 'patch' / 'minor' の場合のみ eligible=true（'minor' が1件でも
 * あれば bumpLevel='minor'、無ければ 'patch'）。1件でも'major'/未設定が残っていればfalse。
 * コミット中にPR番号を特定できないものが1件でもあれば安全側でfalse。
 */
export const determineAutoReleaseEligibility = (params: {
    prLevels: (string | undefined)[];
    unresolvedCommitCount: number;
}): AutoReleaseEligibility => {
    if (params.unresolvedCommitCount > 0) {
        return {
            eligible: false,
            reason: `PR番号を特定できないコミットが${params.unresolvedCommitCount}件あるため見送ります`,
        };
    }
    const releasablePrLevels = params.prLevels.filter(
        (level) => level !== 'none',
    );
    if (releasablePrLevels.length === 0) {
        return {
            eligible: false,
            reason: 'リリース対象PR（semver:noneを除く）が無いため見送ります',
        };
    }
    const nonReleasable = releasablePrLevels.filter(
        (level) => level !== 'patch' && level !== 'minor',
    );
    if (nonReleasable.length > 0) {
        return {
            eligible: false,
            reason: `majorラベル・未設定のPRが${nonReleasable.length}件含まれるため見送ります`,
        };
    }
    const bumpLevel: ReleaseBumpLevel = releasablePrLevels.includes('minor')
        ? 'minor'
        : 'patch';
    return {
        eligible: true,
        bumpLevel,
        reason: `対象${releasablePrLevels.length}件のPRがpatch/minorラベルのため自動リリースします（${bumpLevel}バンプ）`,
    };
};

/**
 * lastTagをbumpLevelに応じて次のバージョンへ進める（例: "v1.32.0" →
 * patch: "v1.32.1" / minor: "v1.33.0"）。パース不能な場合はnull（初回リリース等、
 * 自動リリース対象外）。
 */
export const computeNextVersion = (
    lastTag: string | null,
    bumpLevel: ReleaseBumpLevel,
): string | null => {
    if (!lastTag) {
        return null;
    }
    const match = lastTag.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        return null;
    }
    const major = match[1];
    const minor = Number.parseInt(match[2], 10);
    const patch = Number.parseInt(match[3], 10);
    if (bumpLevel === 'minor') {
        return `v${major}.${minor + 1}.0`;
    }
    return `v${major}.${minor}.${patch + 1}`;
};

interface RunAutoReleaseParams {
    githubToken: string;
    owner: string;
    repo: string;
}

/** 自動リリースの判定・実行を行う。実行結果の説明文字列を返す。 */
export const runAutoRelease = async (
    params: RunAutoReleaseParams,
): Promise<string> => {
    const lastTag = await fetchLatestReleaseTag(params);

    const { prNumbers, unresolvedCommitCount } =
        await fetchMergedPrNumbersSinceTag({
            ...params,
            lastTag,
        });

    const prLevels = await Promise.all(
        prNumbers.map((prNumber) =>
            fetchPrSemverLevel({ ...params, prNumber }),
        ),
    );

    const eligibility = determineAutoReleaseEligibility({
        prLevels,
        unresolvedCommitCount,
    });
    if (!eligibility.eligible || !eligibility.bumpLevel) {
        return `自動リリースを見送りました: ${eligibility.reason}`;
    }

    const nextVersion = computeNextVersion(lastTag, eligibility.bumpLevel);
    if (!nextVersion) {
        return '直前の実タグが無い、または解析できないため自動リリースを見送りました。';
    }

    const summaryBody = await generateReleaseSummary({
        ...params,
        nextVersion,
    });
    const response = await fetch(
        `${GITHUB_API_URL}/repos/${params.owner}/${params.repo}/releases`,
        {
            method: 'POST',
            headers: {
                ...githubHeaders(params.githubToken),
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                tag_name: nextVersion,
                target_commitish: 'main',
                name: nextVersion,
                body: `${buildAutoReleaseNotice(eligibility.bumpLevel)}${summaryBody}`,
                draft: false,
                prerelease: false,
            }),
        },
    );
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `自動リリースの作成に失敗しました (HTTP ${response.status}): ${errorBody}`,
        );
    }
    return `自動リリースを作成しました: ${nextVersion}（${eligibility.reason}）`;
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

    try {
        const result = await runAutoRelease({ githubToken, owner, repo });
        console.log(result);
    } catch (error) {
        console.error(`自動リリース処理でエラーが発生しました: ${error}`);
        process.exit(1);
    }
}
