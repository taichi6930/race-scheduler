#!/usr/bin/env bun
/**
 * test-gap-analysis.ts
 *
 * 各パッケージの `src/` 配下のファイルについて、実際の `bun test --coverage`（lcov）実測値を
 * 用いて C0（Funcs）/C1（Lines）カバレッジを集計し、100%未満のファイルを gap として報告する。
 *
 * 旧バージョンは「テストファイルの import 文字列に src パスが含まれるか」という
 * ヒューリスティックだったため、他の src ファイル経由で間接的にテストされているファイル
 * （例: router.ts からのみ呼ばれる middleware）を誤って「未参照」と報告していた。
 * このバージョンは `bun test --coverage --coverage-reporter=lcov` を内部で実行し、
 * 実際にどの行・関数が実行されたかを直接計測するため、そのような誤検知が起きない。
 *
 * 実行のたびにテストスイートを実際に走らせるため数秒〜十数秒かかる。
 * CI（coverage-pr.yml）と同一条件になるよう NODE_ENV=ci_local, TZ=jst,
 * HTML_FETCH_DELAY_MS=0 を設定して実行する（CI=true は GitHub Actions が自動設定する）。
 *
 * 使い方:
 *   bun scripts/test-gap-analysis.ts                  # 全パッケージ、人間向け表示（gapファイルはTOP10まで要約）
 *   bun scripts/test-gap-analysis.ts --all            # gapファイルを全件表示（TOK-049: 既定は要約、全件は明示指定時のみ）
 *   bun scripts/test-gap-analysis.ts --json           # JSON 出力 (CI / PRコメント用、常に全件)
 *   bun scripts/test-gap-analysis.ts --pkg core       # 特定パッケージのみ（該当パッケージのテストのみ実行、高速）
 */

/* eslint-disable no-console */
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { walkDir } from './lib/walkDir';

interface GapFile {
    file: string;
    funcsPct: number;
    linesPct: number;
    uncoveredLines: string;
}

interface PackageGap {
    package: string;
    totalSrcFiles: number;
    coveredSrcFiles: number;
    gapSrcFiles: GapFile[];
}

interface FileCoverage {
    funcsPct: number;
    linesPct: number;
    uncoveredLines: number[];
}

const ROOT = process.cwd();
const PACKAGES_DIR = join(ROOT, 'packages');

// front パッケージは testing-conventions.md §7.5 により C0/C1 100% の対象外
const PACKAGES_EXCLUDED_FROM_MANDATE = new Set(['front']);

const EXCLUDE_FILE_PATTERNS = [
    /index\.ts$/,
    /\.d\.ts$/,
    /\.config\.ts$/,
    // 定数ファイル（データ定義のみ）
    /[/\\]constants[/\\]/,
    // 型定義ファイル
    /[/\\]types[/\\]/,
    // バッチCLIの薄いエントリーポイント（`if (import.meta.main)` 分岐のみ）。
    // `Bun.spawnSync` のサブプロセス経由でしか実行されず親プロセスの coverage
    // instrumentation に乗らないため恒久的に対応不要（実処理は batchCli.ts に
    // 分離済みで、そちらは通常の UT で 100% カバーされる）。
    /[/\\]batch[/\\]src[/\\]cli\.ts$/,
    // Workflows の薄いエントリーポイント（CICD-73）。`cloudflare:workers`
    // （Workers ランタイム固有の仮想モジュール）に依存する `WorkflowEntrypoint`
    // を継承する部分は bun test 実行環境から解決できないため恒久的に対応不要
    // （実処理は batchAllWorkflowLogic.ts に分離済みで、そちらは通常の UT で
    // 100% カバーされる。cli.ts と同じ設計方針）。
    /[/\\]batch[/\\]src[/\\]workflows[/\\]batchAllWorkflow\.ts$/,
];

const NOTES = [
    'このレポートは `bun test --coverage` の実測値（lcov）に基づく。import文字列マッチングによる',
    '推測ではないため、他ファイル経由で間接的にテストされているファイルを誤検知しない。',
    '',
    '100%未満のファイルが残っている場合、以下の4パターンは「対応不要な既知の例外」であることが多い。',
    '対応前に必ず該当行を確認すること:',
    '  1. 防御的だが到達不能なコード: ガード節の直前に `@remarks` コメントで理由が明記されている',
    '     場合がある（例: packages/api/src/utility/calendarRaceFilterRules.ts の getPriority）。',
    '  2. bun coverage の instrumentation artifact: switch 文の最終 case の閉じ括弧や、',
    '     既に実行済みのオブジェクトリテラル内の文字列リテラルのみのプロパティ行が、',
    '     実際には実行されているにもかかわらず 0 カウントとして報告されることがある。',
    '  3. サブプロセス経由のテスト: `Bun.spawnSync` で別プロセスとして起動して検証する',
    '     ファイル（例: cli.ts）は、親プロセスの coverage instrumentation が観測できないため',
    '     テストが存在していても常に 0% と報告される（bun のカバレッジ計測自体の制約）。',
    '  4. ローカル限定のfixtureテスト: packages/scraping/test/mockData/html はダウンロード',
    '     スクリプト（download-mock-html.sh）で用意する必要があり、未取得の環境や CI 上では',
    '     `it.skipIf(isCI)` によりテストごとスキップされ、当該ファイルのカバレッジが低く',
    '     見える（scraping パーサの一部が該当。詳細は packages/scraping/test/mockData/README.md）。',
];

const isExcluded = (file: string): boolean =>
    EXCLUDE_FILE_PATTERNS.some((pattern) => pattern.test(file));

/**
 * ランタイムの実行コードを一切含まない（interface/type 宣言のみの）ファイルかを判定する。
 * `import type` のみで参照される型専用ファイルは実際には require されず bun の
 * coverage instrumentation に一切現れないため、lcov 上「未計測」と「未テスト」を
 * 区別できない。ファイル内容から判定し、型専用ファイルは gap から除外する。
 * @param filePath 判定対象のファイルパス
 */
const isTypeOnlySourceFile = (filePath: string): boolean => {
    let content: string;
    try {
        content = readFileSync(filePath, 'utf8');
    } catch {
        return false;
    }
    const hasRuntimeExport =
        /export\s+(const|function|class|enum|default|async function)\b/.test(
            content,
        );
    if (hasRuntimeExport) return false;
    return /export\s+(interface|type)\b/.test(content);
};

const collectPackages = (): string[] => {
    try {
        return readdirSync(PACKAGES_DIR).filter((name) => {
            const stat = statSync(join(PACKAGES_DIR, name));
            return stat.isDirectory();
        });
    } catch {
        return [];
    }
};

/**
 * 未カバー行番号の配列を "12,20-24,30" のような範囲表記にまとめる
 * @param lines 未カバー行番号の配列
 */
const formatLineRanges = (lines: number[]): string => {
    if (lines.length === 0) return '';
    const sorted = [...lines].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (const line of sorted.slice(1)) {
        if (line !== prev + 1) {
            ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
            start = line;
        }
        prev = line;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(',');
};

/**
 * `bun test --coverage --coverage-reporter=lcov` を実行し、lcov レポートの内容を返す
 * @remarks
 * bunfig.toml の `[test] coverageDir = "coverage"` はCLIの `--coverage-dir` より
 * 優先されるため（bun 1.3系で確認）、一意な一時ディレクトリへの出力は機能しない。
 * そのため bunfig.toml と同じ固定パス（`<repo root>/coverage/lcov.info`）を直接読む。
 * 前回実行の残骸を誤って読まないよう、実行前に既存ファイルを削除しておく。
 * @param pkg 対象パッケージ名（未指定なら全パッケージ）
 */
const runCoverage = (pkg?: string): string => {
    const coverageDir = join(ROOT, 'coverage');
    const lcovPath = join(coverageDir, 'lcov.info');
    rmSync(lcovPath, { force: true });

    const args = [
        'test',
        ...(pkg ? [`packages/${pkg}/test`] : []),
        '--coverage',
        '--coverage-reporter=lcov',
        // sIT（test/integration/system）はUAT smokeと同じく定期実行(uat-smoke.yml)側に
        // 寄せているため、PR毎のgap分析には含めない（miniflare起動コストを避ける）
        '--path-ignore-patterns',
        '**/test/integration/system/**',
    ];
    const proc = Bun.spawnSync({
        cmd: ['bun', ...args],
        cwd: ROOT,
        env: {
            ...process.env,
            // ローカル実行時も CI=true を明示的に強制する。GitHub Actions は
            // 自動で CI=true を設定するが、ローカル端末の process.env には
            // 通常存在しないため、継承に任せると「モックHTML未取得かつ
            // CI=false」という実際の CI では起こらない状態になり、
            // fixture 依存テストが skip ではなく throw して結果が不安定になる。
            CI: 'true',
            NODE_ENV: 'ci_local',
            TZ: 'jst',
            HTML_FETCH_DELAY_MS: '0',
        },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    try {
        return readFileSync(lcovPath, 'utf8');
    } catch {
        const stderr = proc.stderr.toString().slice(0, 4000);
        throw new Error(
            `lcov レポートの生成に失敗しました（bun test の異常終了の可能性）。stderr:\n${stderr}`,
        );
    }
};

/**
 * lcov 形式のテキストをパースし、ファイルパスごとのカバレッジ情報を返す
 * @param lcov lcov レポートの内容
 */
const parseLcov = (lcov: string): Map<string, FileCoverage> => {
    const result = new Map<string, FileCoverage>();
    for (const record of lcov.split('end_of_record')) {
        const sfMatch = /^SF:(.+)$/m.exec(record);
        if (!sfMatch) continue;
        const file = sfMatch[1].trim();

        const fnf = Number(/^FNF:(\d+)$/m.exec(record)?.[1] ?? '0');
        const fnh = Number(/^FNH:(\d+)$/m.exec(record)?.[1] ?? '0');
        const lf = Number(/^LF:(\d+)$/m.exec(record)?.[1] ?? '0');
        const lh = Number(/^LH:(\d+)$/m.exec(record)?.[1] ?? '0');

        const uncoveredLines: number[] = [];
        for (const daMatch of record.matchAll(/^DA:(\d+),(\d+)$/gm)) {
            if (Number(daMatch[2]) === 0) {
                uncoveredLines.push(Number(daMatch[1]));
            }
        }

        result.set(file, {
            funcsPct: fnf === 0 ? 100 : (fnh / fnf) * 100,
            linesPct: lf === 0 ? 100 : (lh / lf) * 100,
            uncoveredLines,
        });
    }
    return result;
};

const isFullyCovered = (coverage: FileCoverage | undefined): boolean =>
    coverage !== undefined &&
    coverage.funcsPct >= 100 &&
    coverage.linesPct >= 100;

const analyzePackage = (
    pkg: string,
    coverageByFile: Map<string, FileCoverage>,
): PackageGap => {
    const srcDir = join(PACKAGES_DIR, pkg, 'src');
    const srcFiles = walkDir(srcDir, (full) => full.endsWith('.ts')).filter(
        (file) => !isExcluded(file),
    );

    const gap: GapFile[] = [];
    let covered = 0;
    for (const srcFile of srcFiles) {
        const relPath = relative(ROOT, srcFile).split(sep).join('/');
        const coverage = coverageByFile.get(relPath);
        if (coverage === undefined && isTypeOnlySourceFile(srcFile)) {
            covered += 1;
            continue;
        }
        if (isFullyCovered(coverage)) {
            covered += 1;
        } else {
            gap.push({
                file: relPath,
                funcsPct: Math.round((coverage?.funcsPct ?? 0) * 100) / 100,
                linesPct: Math.round((coverage?.linesPct ?? 0) * 100) / 100,
                uncoveredLines: formatLineRanges(
                    coverage?.uncoveredLines ?? [],
                ),
            });
        }
    }

    return {
        package: pkg,
        totalSrcFiles: srcFiles.length,
        coveredSrcFiles: covered,
        gapSrcFiles: gap,
    };
};

const main = (): void => {
    const args = process.argv.slice(2);
    const isJson = args.includes('--json');
    const isAll = args.includes('--all');
    const pkgIndex = args.indexOf('--pkg');
    const onlyPkg = pkgIndex === -1 ? undefined : args[pkgIndex + 1];

    const packages = collectPackages().filter(
        (pkg) => !onlyPkg || pkg === onlyPkg,
    );

    const lcov = runCoverage(onlyPkg);
    const coverageByFile = parseLcov(lcov);

    const results = packages.map((pkg) => analyzePackage(pkg, coverageByFile));

    if (isJson) {
        process.stdout.write(
            `${JSON.stringify({ results, notes: NOTES }, null, 2)}\n`,
        );
        return;
    }

    console.log('\n📊 Test Gap Analysis（bun test --coverage 実測ベース）');
    console.log('━'.repeat(60));
    for (const result of results) {
        const ratio =
            result.totalSrcFiles === 0
                ? 100
                : Math.round(
                      (result.coveredSrcFiles / result.totalSrcFiles) * 100,
                  );
        const mandateNote = PACKAGES_EXCLUDED_FROM_MANDATE.has(result.package)
            ? '（C0/C1 100%義務の対象外）'
            : '';
        console.log(
            `\n📦 ${result.package}${mandateNote} — ${result.coveredSrcFiles}/${result.totalSrcFiles} files at 100% C0/C1 (${ratio}%)`,
        );
        if (result.gapSrcFiles.length === 0) {
            console.log('   ✅ 全 src ファイルが C0/C1 100% です');
            continue;
        }
        console.log(
            `   ⚠️  100%未満の src ファイル (${result.gapSrcFiles.length} 件):`,
        );
        const shownLimit = isAll ? result.gapSrcFiles.length : 10;
        for (const gapFile of result.gapSrcFiles.slice(0, shownLimit)) {
            console.log(
                `      - ${gapFile.file} (Funcs ${gapFile.funcsPct}% / Lines ${gapFile.linesPct}%)${
                    gapFile.uncoveredLines ? ` [${gapFile.uncoveredLines}]` : ''
                }`,
            );
        }
        if (result.gapSrcFiles.length > shownLimit) {
            console.log(
                `      ... and ${result.gapSrcFiles.length - shownLimit} more (--all で全件表示)`,
            );
        }
    }

    console.log('\n📝 補足');
    for (const line of NOTES) {
        console.log(line === '' ? '' : `   ${line}`);
    }
    console.log('');
};

main();
