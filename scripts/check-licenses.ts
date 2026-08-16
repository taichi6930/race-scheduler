#!/usr/bin/env bun
/**
 * check-licenses.ts
 *
 * TypeScript/npmエコシステムの依存パッケージのライセンスを機械的にチェックする
 * （OPS-03対応）。目視確認では現状GPL系の混入は無いことを確認済みだが、
 * 依存追加のたびに再確認する仕組みが無かったため、CI（scheduled-tests.yml）に
 * 組み込んで継続的に保証する。
 *
 * ルート + 各TSパッケージ（admin/api/batch/core）はそれぞれ
 * 独立した node_modules を持つ（bun workspace のisolated linker）ため、
 * ディレクトリ単位で `license-checker` を実行し結果を集約する。
 * 各パッケージ自身（`@race-schedule/*`）は package.json に `private: true` を
 * 設定済みのため `--excludePrivatePackages` で除外される。
 *
 * 使い方:
 *   bun scripts/check-licenses.ts
 *
 * （`bun install` 済みであること。`bunx license-checker` は初回実行時に
 *   ネットワーク経由で取得される）
 */

import { spawnSync } from 'node:child_process';

export interface LicenseCheckerEntry {
    licenses?: string | string[];
}

// GPL系（コピーレフト）ライセンス。商用ネットワークサービス（本リポジトリの
// Cloudflare Workers運用）と相性が悪く混入を避けたいライセンス群。
export const DISALLOWED_LICENSE_PATTERNS = [
    /(^|[^A-Za-z])A?GPL(-|\b)/i,
    /LGPL(-|\b)/i,
    /SSPL/i,
    /CC-BY-NC/i,
    /\bOSL(-|\b)/i,
    /\bCPAL(-|\b)/i,
    /\bEUPL(-|\b)/i,
];

// SEC-034: generate-sbom.tsも同じ対象ディレクトリ一覧を使うため公開する。
export const TARGET_DIRS = [
    '.',
    'packages/admin',
    'packages/api',
    'packages/batch',
    'packages/core',
];

export interface Violation {
    dir: string;
    packageName: string;
    license: string;
}

export function licenseStrings(
    licenses: LicenseCheckerEntry['licenses'],
): string[] {
    if (licenses == null) return ['UNKNOWN'];
    return Array.isArray(licenses) ? licenses : [licenses];
}

export function isDisallowed(license: string): boolean {
    if (license === 'UNKNOWN') return true;
    return DISALLOWED_LICENSE_PATTERNS.some((pattern) => pattern.test(license));
}

export function findViolations(
    dir: string,
    entries: Record<string, LicenseCheckerEntry>,
): Violation[] {
    const violations: Violation[] = [];
    for (const [packageName, entry] of Object.entries(entries)) {
        for (const license of licenseStrings(entry.licenses)) {
            if (isDisallowed(license)) {
                violations.push({ dir, packageName, license });
            }
        }
    }
    return violations;
}

function checkDir(dir: string): Violation[] {
    const result = spawnSync(
        'bunx',
        ['license-checker', '--json', '--excludePrivatePackages'],
        { cwd: dir, encoding: 'utf-8' },
    );
    if (result.status !== 0) {
        throw new Error(
            `license-checker の実行に失敗しました（${dir}）: ${result.stderr}`,
        );
    }

    const parsed = JSON.parse(result.stdout) as Record<
        string,
        LicenseCheckerEntry
    >;
    return findViolations(dir, parsed);
}

function main(): void {
    const allViolations = TARGET_DIRS.flatMap(checkDir);

    if (allViolations.length > 0) {
        console.error(
            '❌ 許可されていない、または不明なライセンスの依存関係を検出しました:\n',
        );
        for (const v of allViolations) {
            console.error(`  [${v.dir}] ${v.packageName}: ${v.license}`);
        }
        console.error(
            '\nGPL系（コピーレフト）ライセンスや不明なライセンスは使用を避けてください。' +
                '意図的に許可する場合は scripts/check-licenses.ts のDISALLOWED_LICENSE_PATTERNSを見直してください。',
        );
        process.exit(1);
    }

    console.log(
        `✅ ライセンスチェック: 対象${TARGET_DIRS.length}ディレクトリすべてで許可されないライセンスは検出されませんでした`,
    );
}

if (import.meta.main) {
    main();
}
