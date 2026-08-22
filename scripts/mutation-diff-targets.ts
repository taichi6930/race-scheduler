#!/usr/bin/env bun
/**
 * mutation-diff-targets.ts
 *
 * PRの変更ファイル一覧（changed-files.txt、`git diff --name-only` の出力）から、
 * 各パッケージの `stryker.<pkg>.config.json` の `mutate` スコープに実際に入る
 * ファイルだけを抽出する。
 *
 * `stryker run --mutate <files>` はCLIの `--mutate` がconfig側の `mutate` 配列を
 * 丸ごと上書きするため（`.github/workflows/mutation-testing.yml` の mutation-api
 * matrixで踏んだ制約と同じ）、config側の除外パターン（index.ts・constants/・
 * types/・api限定でopenapi/）をここで手動で再現している。
 *
 * 使い方:
 *   bun scripts/mutation-diff-targets.ts changed-files.txt
 *   → 標準出力へ `{"core": ["packages/core/src/..."], "admin": [...]}` 形式のJSON
 *     （対象ファイルが1件も無いパッケージはキー自体を出力しない）
 */

import { readFileSync } from 'node:fs';

/** stryker.<pkg>.config.json の mutate 対象パッケージ一覧。front/dbは対象外。 */
export const MUTATION_PACKAGES = ['core', 'admin', 'batch', 'api'] as const;

export type MutationPackage = (typeof MUTATION_PACKAGES)[number];

/**
 * 1ファイルが指定パッケージの stryker `mutate` スコープに入るかどうかを判定する。
 * 各 stryker.<pkg>.config.json の mutate/ignorePatterns と同じ除外ルール
 * （index.ts・constants/・types/、api限定でopenapi/）を再現する。
 * @param file - `packages/<pkg>/src/...` 形式のファイルパス
 * @param pkg - 判定対象パッケージ
 */
export const isMutationTarget = (
    file: string,
    pkg: MutationPackage,
): boolean => {
    const prefix = `packages/${pkg}/src/`;
    if (!file.startsWith(prefix) || !file.endsWith('.ts')) return false;
    if (file.endsWith('/index.ts')) return false;
    if (file.includes('/constants/')) return false;
    if (file.includes('/types/')) return false;
    if (pkg === 'api' && file.startsWith('packages/api/src/openapi/'))
        return false;
    return true;
};

/**
 * 変更ファイル一覧をパッケージごとに分類し、各パッケージの mutate スコープに
 * 入るファイルだけを残す。
 * @param changedFiles - 変更ファイルパスの一覧
 */
export const groupMutationTargets = (changedFiles: string[]) => {
    const result: Partial<Record<MutationPackage, string[]>> = {};
    for (const pkg of MUTATION_PACKAGES) {
        const files = changedFiles.filter((file) =>
            isMutationTarget(file, pkg),
        );
        if (files.length > 0) {
            result[pkg] = files;
        }
    }
    return result;
};

const readChangedFiles = (path: string): string[] =>
    readFileSync(path, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

const main = (): void => {
    const [changedFilesPath] = process.argv.slice(2);
    if (!changedFilesPath) {
        throw new Error(
            '使い方: bun scripts/mutation-diff-targets.ts <changed-files.txtのパス>',
        );
    }

    const changedFiles = readChangedFiles(changedFilesPath);
    const targets = groupMutationTargets(changedFiles);
    console.log(JSON.stringify(targets));
};

if (import.meta.main) {
    main();
}
