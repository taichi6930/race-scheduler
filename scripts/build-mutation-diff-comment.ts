#!/usr/bin/env bun
/**
 * build-mutation-diff-comment.ts
 *
 * PR差分スコープで実行したStrykerのJSONレポート（`--reporters json` の出力、
 * `reports/mutation/mutation.json`）を読み込み、`mutation-diff-report.yml` の
 * PRコメント用Markdownを標準出力に書き出す。
 *
 * このチェックは非ブロッキング（情報提供のみ）。理由は`.github/workflows/
 * mutation-diff-report.yml` 冒頭のコメント、および `docs/README.md` の
 * ミューテーションテストの節を参照（equivalent mutantの誤検知や、
 * command runnerが1ミュータントごとにテストスイート全体を再実行する
 * コスト構造から、PR単位のブロッキングゲート化はまだ見送っている）。
 *
 * 使い方:
 *   bun scripts/build-mutation-diff-comment.ts core:reports/mutation-diff/core.json admin:reports/mutation-diff/admin.json ...
 *   （`<package>:<mutation.jsonのパス>` 形式を引数分だけ渡す）
 */

import { readFileSync } from 'node:fs';

interface MutantLocation {
    start: { line: number; column: number };
    end: { line: number; column: number };
}

interface Mutant {
    id: string;
    mutatorName: string;
    status: string;
    location: MutantLocation;
    replacement?: string;
}

interface StrykerJsonReport {
    files: Record<string, { mutants: Mutant[] }>;
}

interface PackageResult {
    pkg: string;
    files: string[];
    killed: number;
    survived: Array<{ file: string; mutant: Mutant }>;
    /**
     * カバレッジ計測対象外だった（coverageAnalysis: "off"のため実際にはほぼ発生しない）
     * ミュータント数。Stryker公式のスコア計算では分母に含める（殺せなかった扱い）が、
     * PRコメント上の「survivedミュータント一覧」には含めない（テストが走った上で
     * 見逃したSurvivedとは性質が異なるため）。
     */
    noCoverage: number;
    /** Stryker公式のスコア計算から除外されるステータス（CompileError/RuntimeError）のカウント。 */
    excluded: number;
}

/** Stryker公式のスコア計算に含める「殺せた」扱いのステータス。 */
const KILLED_LIKE_STATUSES = new Set(['Killed', 'Timeout']);

/**
 * StrykerのJSONレポート1件を集計する。
 * @param pkg - パッケージ名
 * @param report - `reports/mutation/mutation.json` の内容
 */
export const summarizePackageReport = (
    pkg: string,
    report: StrykerJsonReport,
): PackageResult => {
    const files = Object.keys(report.files);
    let killed = 0;
    let noCoverage = 0;
    let excluded = 0;
    const survived: Array<{ file: string; mutant: Mutant }> = [];

    for (const [file, { mutants }] of Object.entries(report.files)) {
        for (const mutant of mutants) {
            if (KILLED_LIKE_STATUSES.has(mutant.status)) {
                killed += 1;
            } else if (mutant.status === 'Survived') {
                survived.push({ file, mutant });
            } else if (mutant.status === 'NoCoverage') {
                noCoverage += 1;
            } else {
                excluded += 1;
            }
        }
    }

    return { pkg, files, killed, survived, noCoverage, excluded };
};

/**
 * スコア（%）を計算する（Stryker公式の計算式: killed / (killed + survived + noCoverage) * 100。
 * 分母が0件なら対象ミュータント無しとしてnullを返す）。
 * @param result - summarizePackageReport の結果
 */
export const calculateScore = (result: PackageResult): number | null => {
    const denominator =
        result.killed + result.survived.length + result.noCoverage;
    if (denominator === 0) return null;
    return Math.round((result.killed / denominator) * 1000) / 10;
};

const SURVIVED_LIST_LIMIT = 30;

const formatSurvivedMutant = (
    entry: PackageResult['survived'][number],
): string => {
    const { file, mutant } = entry;
    const { line, column } = mutant.location.start;
    return `- \`${file}:${line}:${column}\` — ${mutant.mutatorName}`;
};

const buildPackageSection = (result: PackageResult): string[] => {
    const score = calculateScore(result);
    const scoreText = score === null ? '対象ミュータントなし' : `${score}%`;
    const lines = [
        `### ${result.pkg}（変更ファイル ${result.files.length}件）`,
        '',
        `- ミューテーションスコア: **${scoreText}**（killed ${result.killed} / survived ${result.survived.length}）`,
    ];
    if (result.excluded > 0) {
        lines.push(
            `- （集計除外: ${result.excluded}件 — コンパイルエラー等でスコア計算対象外）`,
        );
    }
    if (result.noCoverage > 0) {
        lines.push(
            `- （カバレッジ計測対象外: ${result.noCoverage}件 — 通常発生しないはずの状態）`,
        );
    }
    if (result.survived.length > 0) {
        lines.push(
            '',
            '<details><summary>survivedミュータント一覧</summary>',
            '',
        );
        for (const entry of result.survived.slice(0, SURVIVED_LIST_LIMIT)) {
            lines.push(formatSurvivedMutant(entry));
        }
        if (result.survived.length > SURVIVED_LIST_LIMIT) {
            lines.push(
                `- ... and ${result.survived.length - SURVIVED_LIST_LIMIT} more`,
            );
        }
        lines.push('</details>');
    }
    lines.push('');
    return lines;
};

export const buildComment = (results: PackageResult[]): string => {
    const lines = [
        '## 🧬 Mutation Testing (差分スコープ・情報提供のみ)',
        '',
        '> このPRで変更されたsrcファイルだけを対象に、その場でStrykerを実行した結果です。',
        '> **非ブロッキングです**（マージの可否には影響しません）。survivedミュータントが',
        '> 見つかった場合、可能ならこのPRで直しても良いですし、後回しにしても構いません',
        '> （継続的な改善は `docs/tasks/test-quality-audit.md` のバックログで扱います）。',
        '',
        ...results.flatMap((result) => buildPackageSection(result)),
        '_Generated by `scripts/build-mutation-diff-comment.ts`. 詳細は .claude/docs/testing-conventions.md を参照_',
    ];
    return lines.join('\n');
};

interface ParsedArg {
    pkg: string;
    path: string;
}

const parseArg = (arg: string): ParsedArg => {
    const separatorIndex = arg.indexOf(':');
    if (separatorIndex === -1) {
        throw new Error(
            `引数は"<package>:<mutation.jsonのパス>"形式である必要があります: ${arg}`,
        );
    }
    return {
        pkg: arg.slice(0, separatorIndex),
        path: arg.slice(separatorIndex + 1),
    };
};

const main = (): void => {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        throw new Error(
            '使い方: bun scripts/build-mutation-diff-comment.ts <package>:<mutation.jsonのパス> ...',
        );
    }

    const summaries = args.map((arg) => {
        const { pkg, path } = parseArg(arg);
        // SAFETY: mutation.jsonはStrykerの`json`reporterが自ら生成する既知フォーマットの出力
        const report = JSON.parse(
            readFileSync(path, 'utf8'),
        ) as StrykerJsonReport;
        return summarizePackageReport(pkg, report);
    });

    process.stdout.write(`${buildComment(summaries)}\n`);
};

if (import.meta.main) {
    main();
}
