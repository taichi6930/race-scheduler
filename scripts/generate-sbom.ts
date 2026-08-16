#!/usr/bin/env bun
/**
 * generate-sbom.ts
 *
 * SEC-034対応: 依存関係の全体像を機械可読な形で持てていない問題への対応として、
 * 名前・バージョン・ライセンスの一覧（簡易SBOM）をJSONで出力する。
 * `check-licenses.ts`（OPS-03）が既に使っている`license-checker`の出力をそのまま
 * 流用し、フルCycloneDX/SPDX形式ではなく最小限の独自JSON形式とする（外部SBOM専用
 * ツールの新規導入・バイナリのチェックサム管理コストを避けるための判断）。
 *
 * 使い方:
 *   bun scripts/generate-sbom.ts > sbom.json
 *
 * （`bun install`済みであること）
 */

/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';

import {
    type LicenseCheckerEntry,
    licenseStrings,
    TARGET_DIRS,
} from './check-licenses';

export interface SbomEntry {
    dir: string;
    name: string;
    version: string;
    licenses: string[];
}

/**
 * `license-checker`の出力キー（例: `lodash@4.17.21`、スコープ付きは`@types/node@20.1.0`）
 * を name/version に分解する。
 * @param key - license-checkerが出力するパッケージキー
 * @returns 分解済みのパッケージ名とバージョン
 */
export function parseNameVersion(key: string): {
    name: string;
    version: string;
} {
    const lastAt = key.lastIndexOf('@');
    // スコープ付きパッケージの先頭@（index 0）はバージョン区切りではないため無視する
    if (lastAt <= 0) return { name: key, version: 'unknown' };
    return { name: key.slice(0, lastAt), version: key.slice(lastAt + 1) };
}

function collectDir(dir: string): SbomEntry[] {
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
    return Object.entries(parsed).map(([key, entry]) => {
        const { name, version } = parseNameVersion(key);
        return { dir, name, version, licenses: licenseStrings(entry.licenses) };
    });
}

/**
 * 複数ディレクトリ分のSBOMエントリを name@version 単位で重複排除する
 * （同じ依存がroot/各パッケージのnode_modulesに複数存在するため）。
 * @param entries - 全ディレクトリから収集したエントリ
 * @returns name昇順にソート済みの重複排除後エントリ
 */
export function dedupeEntries(entries: SbomEntry[]): SbomEntry[] {
    const dedup = new Map<string, SbomEntry>();
    for (const entry of entries) {
        dedup.set(`${entry.name}@${entry.version}`, entry);
    }
    return [...dedup.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function main(): void {
    const entries = TARGET_DIRS.flatMap(collectDir);
    const packages = dedupeEntries(entries);

    console.log(
        JSON.stringify(
            {
                packageCount: packages.length,
                packages,
            },
            null,
            2,
        ),
    );
}

if (import.meta.main) {
    main();
}
