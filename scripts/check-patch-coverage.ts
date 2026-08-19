#!/usr/bin/env bun
/**
 * check-patch-coverage.ts
 *
 * `test-gap-analysis.ts --json` の出力（gap.json）と、このPRで変更されたファイル一覧
 * （changed-files.txt、`git diff --name-only` の出力）を突き合わせ、「変更された
 * ファイルの中に C0/C1 が100%未満のものがあるか」を判定する。
 *
 * これは元々 Codecov の patch coverage（変更行カバレッジ100%必須）ゲートで実現する
 * 想定だったが、CODECOV_TOKEN が未設定のままアップロードが失敗し続けており
 * （coverage.yml は fail_ci_if_error: false のため気づかれずCIがgreenになっていた）、
 * ゲートが一度も機能していなかった。外部サービスに依存せず、既存の
 * test-gap-analysis.ts の実測データだけでブロッキングゲートを実現する。
 *
 * 既存ファイルの積み残しギャップ（このPRで変更していないファイル）はブロックしない
 * （testing-conventions.md §7.5: project全体は当面 informational、patchのみブロッキング
 * という方針を維持する）。
 *
 * 使い方:
 *   bun scripts/check-patch-coverage.ts gap.json changed-files.txt
 *
 * 終了コード: 変更ファイルに gap が無ければ 0、あれば 1。
 */

import { readFileSync } from 'node:fs';

import {
    type GapFile,
    isKnownInstrumentationArtifact,
} from './lib/knownCoverageArtifacts';

export type { GapFile };
export { isKnownInstrumentationArtifact };

interface PackageGap {
    package: string;
    gapSrcFiles: GapFile[];
}

export interface GapReport {
    results: PackageGap[];
}

/**
 * changed-files.txt（改行区切りのファイルパス一覧）を読み込み、Setに変換する。
 * @param path changed-files.txt のパス
 */
const readChangedFiles = (path: string): Set<string> =>
    new Set(
        readFileSync(path, 'utf8')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
    );

/**
 * gap.json の全パッケージの gapSrcFiles を、変更ファイル集合でフィルタする。
 * @param report test-gap-analysis.ts --json の出力
 * @param changedFiles 変更ファイルパスの集合（`packages/xxx/src/...` 形式）
 */
export const findBlockingGaps = (
    report: GapReport,
    changedFiles: Set<string>,
): GapFile[] =>
    report.results
        .flatMap((pkg) => pkg.gapSrcFiles)
        .filter((gapFile) => changedFiles.has(gapFile.file))
        .filter((gapFile) => !isKnownInstrumentationArtifact(gapFile));

const formatGapFile = (gapFile: GapFile): string => {
    const range = gapFile.uncoveredLines ? ` [${gapFile.uncoveredLines}]` : '';
    return `   - ${gapFile.file} (Funcs ${gapFile.funcsPct}% / Lines ${gapFile.linesPct}%)${range}`;
};

/**
 * GitHub Actionsのworkflow commandとして`::error file=<path>::<message>`を出力する。
 * PRの「Files changed」タブに該当ファイル上で直接エラーが表示されるようになり、
 * ログ本文をスクロールしなくても未カバー箇所を発見できる（CILOG-013）。
 */
export const formatGapFileAnnotation = (gapFile: GapFile): string => {
    const range = gapFile.uncoveredLines
        ? `未カバー行: ${gapFile.uncoveredLines}`
        : '未カバー行あり';
    return `::error file=${gapFile.file}::patchカバレッジ不足 (Funcs ${gapFile.funcsPct}% / Lines ${gapFile.linesPct}%) ${range}`;
};

const main = (): void => {
    const [gapJsonPath, changedFilesPath] = process.argv.slice(2);
    if (!gapJsonPath || !changedFilesPath) {
        throw new Error(
            '使い方: bun scripts/check-patch-coverage.ts <gap.jsonのパス> <changed-files.txtのパス>',
        );
    }

    // SAFETY: gap.json は自前の `bun run test:gap:json` が生成する既知フォーマットの出力であり、GapReport の形状を制御できる
    const report = JSON.parse(readFileSync(gapJsonPath, 'utf8')) as GapReport;
    const changedFiles = readChangedFiles(changedFilesPath);
    const blockingGaps = findBlockingGaps(report, changedFiles);

    if (blockingGaps.length === 0) {
        console.log(
            '✅ 変更されたファイルはすべて C0/C1 100% です（patchカバレッジOK）',
        );
        return;
    }

    console.error(
        '❌ 変更されたファイルに C0/C1 が100%未満のものがあります（patchカバレッジNG）:',
    );
    for (const gapFile of blockingGaps) {
        console.error(formatGapFile(gapFile));
        console.error(formatGapFileAnnotation(gapFile));
    }
    console.error(
        '\n新規/変更したコードには必ずユニットテストを書いてください（.claude/docs/testing-conventions.md §7.5）。',
    );
    process.exit(1);
};

if (import.meta.main) {
    main();
}
