#!/usr/bin/env bun
/**
 * generate-symbol-map.ts
 *
 * TOK-059対応: `core` パッケージの公開シンボルを調べるたびに複数回の Glob/Grep が
 * 発生している問題への対応として、`core/src` の各層バレル（`index.ts`）が
 * re-export しているモジュールと、各モジュールが実際に export しているトップレベル
 * シンボル名を1ファイル（JSON + 要約 md）にまとめて出力する。
 *
 * 使い方:
 *   bun scripts/generate-symbol-map.ts
 *   → docs/generated/core-symbol-map.json と docs/generated/core-symbol-map.md を生成
 */

import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

export interface ModuleSymbols {
    path: string;
    symbols: string[];
}

export interface LayerSymbolMap {
    layer: string;
    modules: ModuleSymbols[];
}

export interface BarrelReExport {
    path: string;
    /** `export { A, B } from './x'` のように名前が判明している場合はここに入る。`export * from` は null（要ファイル解決） */
    namedSymbols: string[] | null;
}

const RE_EXPORT_STAR =
    /^export\s+(?:type\s+)?\*\s+from\s+['"](\.[^'"]+)['"];?\s*$/gm;

const RE_EXPORT_NAMED =
    /^export\s+(?:type\s+)?\{([^}]*)\}\s*from\s+['"](\.[^'"]+)['"];?/gm;

const RE_EXPORTED_SYMBOL =
    /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function|class|interface|type|enum|const)\s+([A-Za-z_$][\w$]*)/gm;

/**
 * `export { A, B as C } from './x'` の `{...}` 部分を個々のシンボル名（エイリアス適用後）に分解する
 * @param namedBlock - 波括弧の中身（例: `"A, B as C"`）
 * @returns シンボル名の配列
 */
function parseNamedSymbols(namedBlock: string): string[] {
    return namedBlock
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => part.split(/\s+as\s+/).pop() ?? part);
}

/**
 * バレルファイルの内容から re-export 先を抽出する。`export * from` / `export type * from`
 * （要ファイル解決）と `export { ... } from` / `export type { ... } from`（名前が判明済み）の
 * 両方に対応する
 * @param barrelContent - バレルファイルの内容
 * @returns re-export 情報の配列
 */
export function listBarrelReExports(barrelContent: string): BarrelReExport[] {
    const reExports: BarrelReExport[] = [];
    for (const match of barrelContent.matchAll(RE_EXPORT_STAR)) {
        reExports.push({ path: match[1], namedSymbols: null });
    }
    for (const match of barrelContent.matchAll(RE_EXPORT_NAMED)) {
        reExports.push({
            path: match[2],
            namedSymbols: parseNamedSymbols(match[1]),
        });
    }
    return reExports;
}

/**
 * モジュールの内容からトップレベルで export されているシンボル名を抽出する
 * @param moduleContent - モジュールファイルの内容
 * @returns シンボル名の配列（重複排除・アルファベット順）
 */
export function extractExportedSymbols(moduleContent: string): string[] {
    const names = new Set<string>();
    for (const match of moduleContent.matchAll(RE_EXPORTED_SYMBOL)) {
        names.add(match[1]);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * バレルの re-export 相対パスを実ファイルパスへ解決する（ディレクトリの場合は index.ts を見る）
 * @param barrelDir - バレルファイルが置かれているディレクトリの絶対パス
 * @param relativeExport - `export * from` の相対パス（例: `./model/valueObject`）
 * @param fsDeps - テスト用に差し替え可能な fs 依存
 * @returns 解決済みの絶対ファイルパス（見つからない場合は null）
 */
export function resolveModuleFile(
    barrelDir: string,
    relativeExport: string,
    fsDeps: { existsSync: typeof existsSync; statSync: typeof statSync } = {
        existsSync,
        statSync,
    },
): string | null {
    const asFile = `${join(barrelDir, relativeExport)}.ts`;
    if (fsDeps.existsSync(asFile)) {
        return asFile;
    }
    const asDirIndex = join(barrelDir, relativeExport, 'index.ts');
    if (fsDeps.existsSync(asDirIndex)) {
        return asDirIndex;
    }
    return null;
}

/**
 * `core/src` 直下の各層バレルを走査し、層ごとのシンボルマップを構築する
 * @param coreSrcDir - `packages/core/src` の絶対パス
 * @param fsDeps - テスト用に差し替え可能な fs 依存
 * @returns 層ごとのシンボルマップ
 */
export function buildSymbolMap(
    coreSrcDir: string,
    fsDeps: {
        readdirSync: typeof readdirSync;
        readFileSync: typeof readFileSync;
        existsSync: typeof existsSync;
        statSync: typeof statSync;
    } = { readdirSync, readFileSync, existsSync, statSync },
): LayerSymbolMap[] {
    const layers = fsDeps
        .readdirSync(coreSrcDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    const result: LayerSymbolMap[] = [];
    for (const layer of layers) {
        const layerDir = join(coreSrcDir, layer);
        const barrelPath = join(layerDir, 'index.ts');
        if (!fsDeps.existsSync(barrelPath)) {
            continue;
        }
        const barrelContent = fsDeps.readFileSync(barrelPath, 'utf8');
        const reExports = listBarrelReExports(barrelContent);

        const modules: ModuleSymbols[] = [];
        for (const reExport of reExports) {
            const modulePath = resolveModuleFile(
                layerDir,
                reExport.path,
                fsDeps,
            );
            const displayPath = modulePath
                ? relative(coreSrcDir, modulePath)
                : `${layer}/${reExport.path.replace(/^\.\//, '')}`;
            if (reExport.namedSymbols) {
                modules.push({
                    path: displayPath,
                    symbols: reExport.namedSymbols,
                });
                continue;
            }
            if (!modulePath) {
                continue;
            }
            const moduleContent = fsDeps.readFileSync(modulePath, 'utf8');
            modules.push({
                path: displayPath,
                symbols: extractExportedSymbols(moduleContent),
            });
        }
        result.push({ layer, modules });
    }
    return result;
}

/**
 * シンボルマップを要約 markdown（層ごとのファイル数・シンボル数のみ、詳細は JSON 側）に整形する
 * @param layerMaps - `buildSymbolMap` の結果
 * @returns markdown 文字列
 */
export function formatMarkdownSummary(layerMaps: LayerSymbolMap[]): string {
    const lines = [
        '# core パッケージ 公開シンボルマップ（自動生成）',
        '',
        '`bun scripts/generate-symbol-map.ts` で生成。詳細（ファイル別シンボル一覧）は',
        '`docs/generated/core-symbol-map.json` を参照。',
        '',
        '| 層 | モジュール数 | シンボル数 |',
        '| --- | --- | --- |',
    ];
    for (const { layer, modules } of layerMaps) {
        const symbolCount = modules.reduce(
            (sum, m) => sum + m.symbols.length,
            0,
        );
        lines.push(`| \`${layer}\` | ${modules.length} | ${symbolCount} |`);
    }
    lines.push('');
    return lines.join('\n');
}

if (import.meta.main) {
    const coreSrcDir = join(import.meta.dir, '..', 'packages', 'core', 'src');
    const layerMaps = buildSymbolMap(coreSrcDir);

    const outDir = join(import.meta.dir, '..', 'docs', 'generated');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
        join(outDir, 'core-symbol-map.json'),
        `${JSON.stringify(layerMaps, null, 2)}\n`,
    );
    writeFileSync(
        join(outDir, 'core-symbol-map.md'),
        formatMarkdownSummary(layerMaps),
    );

    // eslint-disable-next-line no-console
    console.log(
        `✅ Generated ${dirname(join(outDir, 'core-symbol-map.json'))}/core-symbol-map.{json,md}`,
    );
}
