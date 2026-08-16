#!/usr/bin/env bun
/**
 * check-package-readme-sync.ts
 *
 * AIEFF-045対応: `packages/README.md` の「各パッケージのドキュメント」表は、各パッケージの
 * README/SETUP/TEST_PLAN 等へのリンクを手書きで維持している。パッケージ追加・ファイル移動時に
 * 表の更新を忘れるとリンク切れ・記載漏れに気づけないため、(1) 表内のリンクが実在するファイルを
 * 指しているか、(2) `packages/` 配下の実ディレクトリが表に1行以上登場しているか、を
 * 機械的に検証する（読み取り専用）。
 *
 * 使い方:
 *   bun scripts/check-package-readme-sync.ts
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface DocLink {
    label: string;
    path: string;
}

export interface PackageRow {
    name: string;
    links: DocLink[];
}

const ROW_RE = /^\|\s*\*\*([\w-]+)\*\*\s*\|(.*)\|\s*$/;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * `packages/README.md` の「各パッケージのドキュメント」表からリンク付き行を抽出する
 * @param mdContent - packages/README.md の内容
 * @returns パッケージ名 → リンク一覧
 */
export function parseDocTable(mdContent: string): PackageRow[] {
    const rows: PackageRow[] = [];
    for (const line of mdContent.split('\n')) {
        const match = ROW_RE.exec(line);
        if (!match) {
            continue;
        }
        const [, name, restCells] = match;
        const links: DocLink[] = [];
        for (const linkMatch of restCells.matchAll(LINK_RE)) {
            links.push({ label: linkMatch[1], path: linkMatch[2] });
        }
        rows.push({ name, links });
    }
    return rows;
}

export interface SyncIssue {
    kind: 'broken-link' | 'undocumented-package';
    detail: string;
}

/**
 * 表のリンクが実在するか・実ディレクトリが表に載っているかを突き合わせる
 * @param rows - `parseDocTable` の出力
 * @param actualPackageDirs - `packages/` 配下の実ディレクトリ名一覧
 * @param linkExists - リンク先パス（packages/からの相対）が実在するかを判定する関数
 * @returns 検出した不整合（無ければ空配列）
 */
export function checkSync(
    rows: PackageRow[],
    actualPackageDirs: string[],
    linkExists: (relPath: string) => boolean,
): SyncIssue[] {
    const issues: SyncIssue[] = [];

    for (const row of rows) {
        for (const link of row.links) {
            if (!linkExists(link.path)) {
                issues.push({
                    kind: 'broken-link',
                    detail: `${row.name}行の「${link.label}」(${link.path}) が実在しない`,
                });
            }
        }
    }

    const documentedNames = new Set(rows.map((r) => r.name));
    for (const dir of actualPackageDirs) {
        if (!documentedNames.has(dir)) {
            issues.push({
                kind: 'undocumented-package',
                detail: `packages/${dir} が packages/README.md の表に記載されていない`,
            });
        }
    }

    return issues;
}

if (import.meta.main) {
    const repoRoot = join(import.meta.dir, '..');
    const packagesDir = join(repoRoot, 'packages');
    const readmePath = join(packagesDir, 'README.md');

    const rows = parseDocTable(readFileSync(readmePath, 'utf8'));
    const actualPackageDirs = readdirSync(packagesDir).filter((entry) =>
        statSync(join(packagesDir, entry)).isDirectory(),
    );
    const issues = checkSync(rows, actualPackageDirs, (relPath) =>
        existsSync(join(packagesDir, relPath)),
    );

    if (issues.length === 0) {
        // eslint-disable-next-line no-console
        console.log('✅ packages/README.md の表と実ファイルは整合しています');
        process.exit(0);
    }

    // eslint-disable-next-line no-console
    console.log(`⚠️  ${issues.length} 件の不整合を検出しました:`);
    for (const issue of issues) {
        // eslint-disable-next-line no-console
        console.log(`   - [${issue.kind}] ${issue.detail}`);
    }
    process.exit(1);
}
