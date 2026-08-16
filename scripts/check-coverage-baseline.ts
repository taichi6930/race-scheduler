#!/usr/bin/env bun
/**
 * check-coverage-baseline.ts
 *
 * `bun run test:gap:json` の出力（JSON）を受け取り、非 front src の C0/C1 カバレッジが
 * ベースライン（100%）を維持しているかを検証する sentinel（CICD-05）。
 *
 * `docs/tasks/BACKLOG.md` §C の確認（2026-07-23）時点で全パッケージが
 * C0/C1 100% を達成しているが、それを保証する仕組みが CI に無かったため、
 * 定期実行（scheduled）/ main への push で本チェックを回し、新たな gap が
 * 混入した場合に検知できるようにする。
 *
 * 既知の計測アーティファクト（`packages/batch/src/cli.ts` / `packages/api/src/router.ts`）は
 * `scripts/lib/knownCoverageArtifacts.ts` の共有許容リストで除外する。
 * `scripts/check-patch-coverage.ts`（PR単位のpatchゲート）と同じ許容リストを参照することで、
 * 片方だけ更新して他方が追随しない事故（PR #2118 参照）を防ぐ。
 *
 * 使い方:
 *   bun run test:gap:json > gap.json
 *   bun scripts/check-coverage-baseline.ts gap.json
 */

/* eslint-disable no-console */
import { readFileSync } from 'node:fs';

import {
    type GapFile,
    isKnownInstrumentationArtifact,
} from './lib/knownCoverageArtifacts';

interface PackageResult {
    package: string;
    totalSrcFiles: number;
    coveredSrcFiles: number;
    gapSrcFiles: GapFile[];
}

interface GapReport {
    results: PackageResult[];
    notes: string[];
}

const gapJsonPath = process.argv[2];
if (gapJsonPath === undefined) {
    console.error(
        '使い方: bun scripts/check-coverage-baseline.ts <gap.jsonのパス>',
    );
    process.exit(1);
}

const report = JSON.parse(readFileSync(gapJsonPath, 'utf-8')) as GapReport;

const unexpectedGaps = report.results.flatMap((pkg) =>
    pkg.gapSrcFiles
        .filter((gap) => !isKnownInstrumentationArtifact(gap))
        .map((gap) => ({ package: pkg.package, ...gap })),
);

if (unexpectedGaps.length > 0) {
    console.error(
        `❌ mainベースライン（C0/C1 100%）を下回るファイルが見つかりました:`,
    );
    for (const gap of unexpectedGaps) {
        console.error(
            `   [${gap.package}] ${gap.file} (C0=${gap.funcsPct}%, C1=${gap.linesPct}%)`,
        );
    }
    process.exit(1);
}

console.log(
    '✅ 非frontパッケージの全srcファイルがC0/C1 100%のベースラインを維持しています（既知の許容ギャップを除く）。',
);
