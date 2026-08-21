#!/usr/bin/env bun
/**
 * autoRelease.ts
 *
 * deploy.yml の post-merge-verify（sIT+UAT smoke）成功後に呼び出される、
 * patch/minor自動リリース + major下書きReleaseの自動作成スクリプト
 * （auto-semver-release-requirements.md §12）。
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
 * 4. 除外後に `semver:major` が1件でも含まれ、かつ他に未設定ラベル・PR番号不明コミットが
 *    無い場合は、実リリースは行わず**下書き（draft）Release**を自動作成/更新する（次のmajor
 *    バージョン、例: `v1.55.0` → `v2.0.0`）。draft ReleaseはGitHub上ではtag_nameを予約する
 *    だけで実タグは作られないため、公開（Publish）は引き続き人間が判断して行う——
 *    「実際にリリースするか」の最終判断は変えず、「次のバージョン番号を計算し本文を
 *    集約する」という人間の手作業だけを肩代わりする
 * 5. 未設定ラベル・PR番号を特定できないコミットが含まれる場合は、実リリースも
 *    下書き作成も行わない（安全側に倒す）
 *
 * Kill Switch（vars.AUTO_RELEASE_ENABLED）の判定はワークフロー側のジョブ`if`で行う
 * （このスクリプトは呼ばれた時点で常に実行する。draft Release作成もこのKill Switch配下）。
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
    findReleaseByTagName,
    generateReleaseSummary,
} from './generateReleaseSummary';

const GITHUB_API_URL = 'https://api.github.com';

const buildAutoReleaseNotice = (bumpLevel: ReleaseBumpLevel): string =>
    bumpLevel === 'minor'
        ? '> 🤖 このリリースはminor（後方互換の新機能追加）までの変更のため自動作成されました\n\n'
        : '> 🤖 このリリースはpatchのみの変更のため自動作成されました\n\n';

const buildMajorDraftNotice = (): string =>
    '> 🤖 major（既存挙動を変える変更）を含むため、下書き（draft）Releaseとして自動作成しました。\n' +
    '> 内容を確認し、問題なければ公開（Publish）してください。公開すると実タグが作成され、production への自動デプロイが走ります。\n\n';

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

export interface MajorDraftEligibility {
    eligible: boolean;
    reason: string;
}

/**
 * PR番号ごとのsemverラベルから、major下書きRelease作成の可否を判定する。
 * 'none'を除外した残りに'major'が1件でも含まれ、かつ'patch'/'minor'/'major'以外
 * （未設定ラベル）が無い場合のみeligible=true。PR番号を特定できないコミットが
 * 1件でもあれば安全側でfalse（determineAutoReleaseEligibilityと同じ方針）。
 * このスキップ条件は「実リリースを見送る」ことと同義ではない点に注意——
 * majorを含む区間は実リリース（determineAutoReleaseEligibility）では常にfalseになるため、
 * 両者は同じ入力に対して排他的に呼ばれる。
 */
export const determineMajorDraftEligibility = (params: {
    prLevels: (string | undefined)[];
    unresolvedCommitCount: number;
}): MajorDraftEligibility => {
    if (params.unresolvedCommitCount > 0) {
        return {
            eligible: false,
            reason: `PR番号を特定できないコミットが${params.unresolvedCommitCount}件あるため下書き作成を見送ります`,
        };
    }
    const releasablePrLevels = params.prLevels.filter(
        (level) => level !== 'none',
    );
    if (!releasablePrLevels.includes('major')) {
        return {
            eligible: false,
            reason: 'majorラベルのPRが含まれないため下書き作成を見送ります',
        };
    }
    const hasUnlabeled = releasablePrLevels.some(
        (level) => level !== 'patch' && level !== 'minor' && level !== 'major',
    );
    if (hasUnlabeled) {
        return {
            eligible: false,
            reason: '未設定ラベルのPRが含まれるため下書き作成を見送ります',
        };
    }
    return {
        eligible: true,
        reason: `対象${releasablePrLevels.length}件のPRにmajorラベルが含まれるため下書きReleaseを作成します`,
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

/**
 * lastTagのmajorを1つ上げ、minor/patchを0にリセットする（例: "v1.32.5" → "v2.0.0"）。
 * パース不能な場合はnull。
 */
export const computeNextMajorVersion = (
    lastTag: string | null,
): string | null => {
    if (!lastTag) {
        return null;
    }
    const match = lastTag.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        return null;
    }
    const major = Number.parseInt(match[1], 10);
    return `v${major + 1}.0.0`;
};

interface RunAutoReleaseParams {
    githubToken: string;
    owner: string;
    repo: string;
    /**
     * release_note テーブルへのdual-write先。省略時（ローカル実行等）はdual-writeをスキップする。
     * `mainApiUrl`は本番API（`vars.MAIN_API_URL`）を指す。
     */
    mainApiUrl?: string;
    serviceAuthToken?: string;
}

interface UpsertMajorDraftReleaseParams extends RunAutoReleaseParams {
    lastTag: string | null;
}

/**
 * majorラベルを含む未リリース区間向けに、下書き（draft）Releaseを作成/更新する。
 * draft Releaseはtag_nameを予約するだけで実タグは作られないため、人間が内容を確認して
 * 公開（Publish）するまで本番デプロイは走らない。同じtag_nameの下書きが既にあれば
 * 本文のみ更新し（新たにPRがマージされるたびにこの関数が呼ばれるため）、無ければ新規作成する。
 * release_note テーブルへのdual-writeは実リリース（公開済みRelease）専用のため、
 * 下書きの間は行わない（公開後の扱いは既存どおり、必要なら
 * backfill-release-notes.yml を手動実行する）。
 */
const upsertMajorDraftRelease = async (
    params: UpsertMajorDraftReleaseParams,
): Promise<string> => {
    const nextVersion = computeNextMajorVersion(params.lastTag);
    if (!nextVersion) {
        return '直前の実タグが無い、または解析できないためmajor下書きReleaseの作成を見送りました。';
    }

    const summaryBody = await generateReleaseSummary({
        ...params,
        nextVersion,
    });
    const body = `${buildMajorDraftNotice()}${summaryBody}`;

    const existing = await findReleaseByTagName({
        ...params,
        tagName: nextVersion,
    });
    if (existing?.draft) {
        const response = await fetch(
            `${GITHUB_API_URL}/repos/${params.owner}/${params.repo}/releases/${existing.id}`,
            {
                method: 'PATCH',
                headers: {
                    ...githubHeaders(params.githubToken),
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ body }),
            },
        );
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `major下書きReleaseの更新に失敗しました (HTTP ${response.status}): ${errorBody}`,
            );
        }
        return `major下書きReleaseを更新しました: ${nextVersion}`;
    }

    // 既存の下書きが無い場合、新規作成する（既存releaseが同名でdraft以外の場合、
    // GitHub側のcreate APIが422で失敗する。この稀なケースを特別扱いする価値は低いため、
    // その場合はエラーがそのままthrowされる想定でよい）。
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
                body,
                draft: true,
                prerelease: false,
            }),
        },
    );
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `major下書きReleaseの作成に失敗しました (HTTP ${response.status}): ${errorBody}`,
        );
    }
    return `major下書きReleaseを作成しました: ${nextVersion}（人間の確認後、Publishしてください）`;
};

/**
 * 作成直後のGitHub Releaseレスポンスから release_note テーブルへの書き込みペイロードを
 * 組み立てる。GitHubのレスポンス形状をそのまま使うことで、front互換の形（ReleaseNote）と
 * 一致させる。
 */
export const buildReleaseNoteWritePayload = (params: {
    release: {
        tag_name: string;
        name: string | null;
        body: string | null;
        published_at: string | null;
        draft: boolean;
        prerelease: boolean;
    };
    sourceRepo: string;
}) => ({
    ...params.release,
    source_repo: params.sourceRepo,
});

/**
 * release_note テーブルへのdual-writeを実行できるかどうかを判定する。
 * 実行しない場合は、欠けている環境変数名を含む警告メッセージを返す
 * （`MAIN_API_URL`/`SERVICE_AUTH_TOKEN` が未設定のままdual-writeが継続的に
 * スキップされていても、これまではCIログに何も残らず気づけなかったため）。
 */
export const resolveDualWriteSkipReason = (params: {
    mainApiUrl?: string;
    serviceAuthToken?: string;
}): string | null => {
    if (params.mainApiUrl && params.serviceAuthToken) {
        return null;
    }
    const missingVars = [
        !params.mainApiUrl && 'MAIN_API_URL',
        !params.serviceAuthToken && 'SERVICE_AUTH_TOKEN',
    ].filter((name): name is string => Boolean(name));
    return `${missingVars.join(' / ')} が未設定のため、release_noteテーブルへのdual-writeをスキップしました`;
};

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
        const majorDraftEligibility = determineMajorDraftEligibility({
            prLevels,
            unresolvedCommitCount,
        });
        if (majorDraftEligibility.eligible) {
            return upsertMajorDraftRelease({ ...params, lastTag });
        }
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
    const createdRelease: unknown = await response.json();

    // release_note テーブルへのdual-writeはあくまで補助的な複製（正の情報源はGitHub
    // Release自体）のため、失敗してもリリース作成自体は成功として扱う（ベストエフォート）。
    // 取りこぼした行は scripts/release/backfillReleaseNotes.ts の再実行で回収できる
    // （(tag_name, source_repo) が一致する行は上書きされる冪等な設計）。
    if (params.mainApiUrl && params.serviceAuthToken) {
        try {
            await writeReleaseNoteBestEffort({
                mainApiUrl: params.mainApiUrl,
                serviceAuthToken: params.serviceAuthToken,
                release: createdRelease,
                sourceRepo: params.repo,
            });
        } catch (error) {
            console.warn(
                `release_noteテーブルへのdual-writeに失敗しましたが、リリース作成自体は続行します: ${error}`,
            );
        }
    } else {
        console.warn(resolveDualWriteSkipReason(params));
    }

    return `自動リリースを作成しました: ${nextVersion}（${eligibility.reason}）`;
};

interface CreatedReleaseResponse {
    tag_name: string;
    name: string | null;
    body: string | null;
    published_at: string | null;
    draft: boolean;
    prerelease: boolean;
}

// SAFETY: 直前の typeof/null チェックで value がオブジェクトであることを確認済みのため、
// プロパティの型を絞り込むための一時的なキャストは安全（型ガード関数自身の実装）
const isCreatedReleaseResponse = (
    value: unknown,
): value is CreatedReleaseResponse =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { tag_name?: unknown }).tag_name === 'string';

/** 作成直後のGitHub Releaseレスポンスを release_note テーブルへ書き込む（POST /release-notes）。 */
const writeReleaseNoteBestEffort = async (params: {
    mainApiUrl: string;
    serviceAuthToken: string;
    release: unknown;
    sourceRepo: string;
}): Promise<void> => {
    if (!isCreatedReleaseResponse(params.release)) {
        throw new Error('GitHub Releaseレスポンスの形式が想定と異なります');
    }
    const payload = buildReleaseNoteWritePayload({
        release: params.release,
        sourceRepo: params.sourceRepo,
    });
    const response = await fetch(`${params.mainApiUrl}/release-notes`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-service-auth-token': params.serviceAuthToken,
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(
            `release_notesへの書き込みに失敗しました (HTTP ${response.status})`,
        );
    }
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
        const result = await runAutoRelease({
            githubToken,
            owner,
            repo,
            mainApiUrl: process.env.MAIN_API_URL,
            serviceAuthToken: process.env.SERVICE_AUTH_TOKEN,
        });
        console.log(result);
    } catch (error) {
        console.error(`自動リリース処理でエラーが発生しました: ${error}`);
        process.exit(1);
    }
}
