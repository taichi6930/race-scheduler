#!/usr/bin/env bun
/**
 * test-changed.ts
 *
 * 変更したファイルに関連するテストだけを実行する（TOK-051）。AIが編集の
 * たびに `bun run test`（モノレポ全体、coverage計測込み）をフルで叩くと
 * 実行時間・出力行数が無駄に大きいため、変更範囲に絞った既定コマンドを
 * 用意する。
 *
 * mainブランチとの分岐点（未コミット分を含む）からの差分ファイルを対象に、
 * - 変更されたテストファイル自体
 * - 変更されたsrcファイルに対応するUTファイル（testing-conventions.md §2）
 * - usecase/controller層の変更時は、ファイル単位で1:1対応しないコンポーネント
 *   テスト（同 §7.5）もパッケージ丸ごと対象に加える
 * を解決し、`bun test` へまとめて渡す。
 *
 * 使い方:
 *   bun run test:changed
 *   bun run test:changed -- --quiet   # 解決したテスト対象一覧の表示を省略する
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const TEST_FILE_PATTERN =
    /^packages\/[^/]+\/test\/(unittest|integration\/component)\/.+\.test\.ts$/;
const SRC_FILE_PATTERN = /^packages\/([^/]+)\/src\/(.+)\.ts$/;
const USECASE_OR_CONTROLLER_PATTERN =
    /^packages\/([^/]+)\/src\/(usecase|controller)\//;

/** `git` を引数配列で実行し、改行区切りの出力を空行を除いた配列で返す。 */
const runGit = (args: string[]): string[] =>
    execFileSync('git', args, { encoding: 'utf-8' })
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

/**
 * mainブランチとの分岐点からの差分ファイル一覧を返す（未コミット分を含む）。
 *
 * `git diff` は未追跡（`git add` 前）のファイルを含まないため、新規追加した
 * srcファイル・testファイルが対象から漏れないよう `git ls-files --others` の
 * 結果も合わせる。
 */
const changedFiles = (): string[] => {
    const base = execFileSync('git', ['merge-base', 'HEAD', 'main'], {
        encoding: 'utf-8',
    }).trim();
    const diffFiles = runGit(['diff', '--name-only', base]);
    const untrackedFiles = runGit([
        'ls-files',
        '--others',
        '--exclude-standard',
    ]);
    return [...new Set([...diffFiles, ...untrackedFiles])];
};

/** srcファイルパスから対応するUTファイルパスを解決する（testing-conventions.md §2）。 */
export const unitTestPathFor = (srcPath: string): string | undefined => {
    const match = SRC_FILE_PATTERN.exec(srcPath);
    if (!match) return undefined;
    const [, pkg, rest] = match;
    return `packages/${pkg}/test/unittest/${rest}.test.ts`;
};

/** usecase/controller層の変更時、対応するコンポーネントテストディレクトリを返す。 */
export const componentTestDirFor = (srcPath: string): string | undefined => {
    const match = USECASE_OR_CONTROLLER_PATTERN.exec(srcPath);
    if (!match) return undefined;
    const dir = `packages/${match[1]}/test/integration/component`;
    return existsSync(dir) ? dir : undefined;
};

/** 変更ファイル一覧から、実在する `bun test` の実行対象パスを解決する。 */
export const resolveTargets = (
    files: string[],
    exists: (path: string) => boolean = existsSync,
): string[] => {
    const targets = new Set<string>();
    for (const file of files) {
        if (TEST_FILE_PATTERN.test(file)) {
            if (exists(file)) targets.add(file);
            continue;
        }
        const unitTestPath = unitTestPathFor(file);
        if (unitTestPath && exists(unitTestPath)) targets.add(unitTestPath);

        const componentDir = componentTestDirFor(file);
        if (componentDir) targets.add(componentDir);
    }
    return [...targets].sort();
};

const main = (): void => {
    const isQuiet = process.argv.includes('--quiet');
    const targets = resolveTargets(changedFiles());
    if (targets.length === 0) {
        console.log(
            'test:changed: 変更ファイルに対応するテストが見つかりませんでした。',
        );
        return;
    }
    if (!isQuiet) {
        console.log(
            `test:changed: ${targets.length}件のテスト対象を解決しました。`,
        );
        for (const target of targets) console.log(`  - ${target}`);
    }
    const result = spawnSync('bun', ['test', ...targets], {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'ci_local',
            TZ: 'jst',
            HTML_FETCH_DELAY_MS: '0',
        },
    });
    process.exit(result.status ?? 1);
};

if (import.meta.main) {
    main();
}
