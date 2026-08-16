#!/usr/bin/env bun
/**
 * generate-layer-dependency-graph.ts
 *
 * AIEFF-057対応: `.claude/docs/coding-conventions.md` が定める
 * controller → usecase → repository → gateway のレイヤー依存順序は、違反そのものは
 * Biome の `noRestrictedImports` で機械的にブロックされているが、「実際にどの層がどれだけ
 * 依存し合っているか」を俯瞰する可視化は無い。admin/api 各Workerの
 * `src/{controller,usecase,repository,gateway}` 配下の相対import関係を走査し、
 * 層単位の依存関係を Mermaid flowchart として出力する（読み取り専用、コード変更は行わない）。
 *
 * 使い方:
 *   bun scripts/generate-layer-dependency-graph.ts [パッケージ名...]
 *   （省略時は admin/api 全て）
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

export type Layer = 'controller' | 'usecase' | 'repository' | 'gateway';
const LAYERS: Layer[] = ['controller', 'usecase', 'repository', 'gateway'];

const IMPORT_RE = /from\s+['"](\.\.?\/[^'"]+)['"]/g;

/**
 * ファイル内容から相対importの指定子（`./xxx`/`../xxx`）をすべて抽出する
 * @param fileContent - TypeScriptファイルの内容
 * @returns import 指定子の配列
 */
export function extractRelativeImports(fileContent: string): string[] {
    const specifiers: string[] = [];
    for (const match of fileContent.matchAll(IMPORT_RE)) {
        specifiers.push(match[1]);
    }
    return specifiers;
}

/**
 * `src/` からの相対パスがどのレイヤーに属するかを判定する
 * @param srcRelativePath - `src/` をルートとした相対パス（posix区切り）
 * @returns 該当レイヤー。層フォルダ配下でなければ `null`
 */
export function classifyLayer(srcRelativePath: string): Layer | null {
    const segments = srcRelativePath.split('/');
    return LAYERS.find((layer) => segments.includes(layer)) ?? null;
}

export interface LayerEdge {
    from: Layer;
    to: Layer;
    count: number;
}

interface SourceFile {
    /** `src/` をルートとした相対パス（posix区切り、拡張子あり） */
    srcRelativePath: string;
    content: string;
}

/**
 * import 指定子をファイルの相対パス基準で解決し、`src/` からの相対パスへ正規化する
 * @param fromSrcRelativePath - import元ファイルの `src/` 相対パス
 * @param specifier - `extractRelativeImports` が返した指定子
 * @returns `src/` からの相対パス（拡張子なしのまま、判定には影響しない）
 */
export function resolveImportPath(
    fromSrcRelativePath: string,
    specifier: string,
): string {
    const fromDir = dirname(fromSrcRelativePath);
    return normalize(join(fromDir, specifier)).split('\\').join('/');
}

/**
 * ソースファイル群からレイヤー間の依存エッジ（有向・件数集計）を組み立てる
 * @param files - `src/` 配下の TypeScript ファイル一覧
 * @returns レイヤー間エッジ（層が同じ・不明な依存は除外）
 */
export function buildLayerEdges(files: SourceFile[]): LayerEdge[] {
    const counts = new Map<string, number>();
    for (const file of files) {
        const fromLayer = classifyLayer(file.srcRelativePath);
        if (!fromLayer) {
            continue;
        }
        for (const specifier of extractRelativeImports(file.content)) {
            const resolved = resolveImportPath(file.srcRelativePath, specifier);
            const toLayer = classifyLayer(resolved);
            if (!toLayer || toLayer === fromLayer) {
                continue;
            }
            const key = `${fromLayer}->${toLayer}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }
    return [...counts.entries()].map(([key, count]) => {
        const [from, to] = key.split('->') as [Layer, Layer];
        return { from, to, count };
    });
}

/**
 * レイヤーエッジを Mermaid flowchart 記法へ整形する
 * @param packageName - グラフのタイトルに使うパッケージ名
 * @param edges - `buildLayerEdges` の出力
 * @returns Mermaid flowchart 文字列
 */
export function toMermaid(packageName: string, edges: LayerEdge[]): string {
    const lines = [`flowchart LR`, `  %% ${packageName}`];
    if (edges.length === 0) {
        lines.push('  %% (依存エッジ無し)');
        return lines.join('\n');
    }
    for (const edge of edges) {
        lines.push(`  ${edge.from} -->|${edge.count}| ${edge.to}`);
    }
    return lines.join('\n');
}

if (import.meta.main) {
    const repoRoot = join(import.meta.dir, '..');
    const targetPackages =
        process.argv.slice(2).length > 0
            ? process.argv.slice(2)
            : ['admin', 'api'];

    for (const pkg of targetPackages) {
        const srcDir = join(repoRoot, 'packages', pkg, 'src');
        const files: SourceFile[] = [];
        const walk = (dir: string): void => {
            for (const entry of readdirSync(dir)) {
                const fullPath = join(dir, entry);
                if (statSync(fullPath).isDirectory()) {
                    walk(fullPath);
                    continue;
                }
                if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) {
                    continue;
                }
                files.push({
                    srcRelativePath: relative(srcDir, fullPath)
                        .split('\\')
                        .join('/'),
                    content: readFileSync(fullPath, 'utf8'),
                });
            }
        };
        walk(srcDir);

        const edges = buildLayerEdges(files);
        // eslint-disable-next-line no-console
        console.log(toMermaid(pkg, edges));
        // eslint-disable-next-line no-console
        console.log('');
    }
}
