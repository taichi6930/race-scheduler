/**
 * generate-symbol-map.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * バレル解析ロジックを誤ると core の公開シンボルマップ（TOK-059）の内容が
 * 欠落・誤表示するため、UTを用意する。実ファイルシステムへの依存は fsDeps 注入で
 * モック化し、ネットワーク・実 core ソースには依存しない。
 *
 * ## デシジョンテーブル
 *
 * ### listBarrelReExports
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | `export * from './x';` | path='./x', namedSymbols=null |
 * | T-02 | `export type * from './x';` | path='./x', namedSymbols=null（type-only star も対象） |
 * | T-03 | `export { A, B } from './x';` | path='./x', namedSymbols=['A','B'] |
 * | T-04 | `export type { A } from './x';` | path='./x', namedSymbols=['A'] |
 * | T-05 | `export { A as B } from './x';` | namedSymbols=['B']（エイリアス適用後の名前） |
 *
 * ### extractExportedSymbols
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-06 | `export function foo() {}` | ['foo'] |
 * | T-07 | `export const bar = 1;` + `export class Baz {}` | ['bar','Baz']（昇順ソート） |
 * | T-08 | 重複した export const | 重複排除される |
 *
 * ### resolveModuleFile
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-09 | `<dir>/x.ts` が存在 | そのパスを返す |
 * | T-10 | `<dir>/x.ts` は無いが `<dir>/x/index.ts` が存在 | ディレクトリ index を返す |
 * | T-11 | どちらも存在しない | null |
 *
 * ### buildSymbolMap
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-12 | 層に barrel(index.ts)が無い | その層はスキップされる |
 * | T-13 | star export + named export が混在するbarrel | 両方がmodulesに反映される |
 *
 * ### formatMarkdownSummary
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-14 | 層ごとのモジュール・シンボル数 | 表形式に集計される |
 */
import { describe, expect, it } from 'bun:test';

import {
    buildSymbolMap,
    extractExportedSymbols,
    formatMarkdownSummary,
    listBarrelReExports,
    resolveModuleFile,
} from './generate-symbol-map';

describe('listBarrelReExports', () => {
    it.each([
        ['[T-01] export * from', "export * from './x';", './x', null],
        ['[T-02] export type * from', "export type * from './x';", './x', null],
    ])('%s', (_label, content, expectedPath, expectedNamed) => {
        const result = listBarrelReExports(content);
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe(expectedPath);
        expect(result[0].namedSymbols).toBe(expectedNamed);
    });

    it.each([
        ['[T-03] named export', "export { A, B } from './x';", ['A', 'B']],
        ['[T-04] named type export', "export type { A } from './x';", ['A']],
        ['[T-05] alias', "export { A as B } from './x';", ['B']],
    ])('%s', (_label, content, expectedNamed) => {
        const result = listBarrelReExports(content);
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe('./x');
        expect(result[0].namedSymbols).toEqual(expectedNamed);
    });
});

describe('extractExportedSymbols', () => {
    it('[T-06] export function からシンボル名を抽出すること', () => {
        expect(extractExportedSymbols('export function foo() {}')).toEqual([
            'foo',
        ]);
    });

    it('[T-07] 複数シンボルが昇順ソートされること（localeCompare準拠）', () => {
        const content = 'export const bar = 1;\nexport class Baz {}';
        expect(extractExportedSymbols(content)).toEqual(['bar', 'Baz']);
    });

    it('[T-08] 重複したシンボルが排除されること', () => {
        const symbols = extractExportedSymbols(
            'export const bar = 1;\nexport const bar = 2;',
        );
        expect(symbols).toEqual(['bar']);
    });
});

// テスト用の fsDeps は node:fs のフルシグネチャ（オーバーロード・PathLike等）を
// 満たす必要が無いため、実装が実際に使う形（string引数）だけを定義し、
// 呼び出し先のパラメータ型へ丸ごとキャストする。
type ResolveModuleFileFsDeps = Parameters<typeof resolveModuleFile>[2];
type BuildSymbolMapFsDeps = Parameters<typeof buildSymbolMap>[1];

describe('resolveModuleFile', () => {
    it('[T-09] <dir>/x.ts が存在する場合はそのパスを返すこと', () => {
        // SAFETY: resolveModuleFile が実際に呼ぶのは existsSync/statSync のみ（string引数）で、
        // node:fs のフルシグネチャを満たすモックは不要なためテスト用の最小実装へキャストしている
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions
        const fsDeps = {
            existsSync: (p: string) => p.endsWith('x.ts'),
            statSync: () => ({}),
        } as unknown as ResolveModuleFileFsDeps;
        expect(resolveModuleFile('/core/utilities', './x', fsDeps)).toBe(
            '/core/utilities/x.ts',
        );
    });

    it('[T-10] x.ts が無く x/index.ts が存在する場合はディレクトリindexを返すこと', () => {
        // SAFETY: resolveModuleFile が実際に呼ぶのは existsSync/statSync のみ（string引数）で、
        // node:fs のフルシグネチャを満たすモックは不要なためテスト用の最小実装へキャストしている
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions
        const fsDeps = {
            existsSync: (p: string) => p.endsWith('index.ts'),
            statSync: () => ({}),
        } as unknown as ResolveModuleFileFsDeps;
        expect(
            resolveModuleFile('/core/domain', './model/valueObject', fsDeps),
        ).toBe('/core/domain/model/valueObject/index.ts');
    });

    it('[T-11] どちらも存在しない場合はnullを返すこと', () => {
        // SAFETY: resolveModuleFile が実際に呼ぶのは existsSync/statSync のみ（string引数）で、
        // node:fs のフルシグネチャを満たすモックは不要なためテスト用の最小実装へキャストしている
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions
        const fsDeps = {
            existsSync: () => false,
            statSync: () => ({}),
        } as unknown as ResolveModuleFileFsDeps;
        expect(
            resolveModuleFile('/core/utilities', './missing', fsDeps),
        ).toBeNull();
    });
});

describe('buildSymbolMap', () => {
    it('[T-12] barrel(index.ts)が無い層はスキップされること', () => {
        const files = new Map<string, string>([
            ['/core/src/withBarrel/index.ts', "export * from './a';"],
        ]);
        // SAFETY: buildSymbolMap が実際に呼ぶのは readdirSync/readFileSync/existsSync/statSync のみ
        // （いずれもstring引数）で、node:fs のフルシグネチャを満たすモックは不要なため
        // テスト用の最小実装へキャストしている
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions
        const fsDeps = {
            readdirSync: () => [
                { name: 'withBarrel', isDirectory: () => true },
                { name: 'noBarrel', isDirectory: () => true },
            ],
            readFileSync: (p: string) => files.get(p) ?? '',
            existsSync: (p: string) => files.has(p) || p.endsWith('a.ts'),
            statSync: () => ({}),
        } as unknown as BuildSymbolMapFsDeps;
        files.set('/core/src/withBarrel/a.ts', 'export const A = 1;');

        const result = buildSymbolMap('/core/src', fsDeps);

        expect(result.map((l) => l.layer)).toEqual(['withBarrel']);
    });

    it('[T-13] star export と named export が混在するbarrelの両方がmodulesに反映されること', () => {
        const files = new Map<string, string>([
            [
                '/core/src/mixed/index.ts',
                "export * from './a';\nexport { B } from './b';",
            ],
            ['/core/src/mixed/a.ts', 'export const A = 1;'],
        ]);
        // SAFETY: buildSymbolMap が実際に呼ぶのは readdirSync/readFileSync/existsSync/statSync のみ
        // （いずれもstring引数）で、node:fs のフルシグネチャを満たすモックは不要なため
        // テスト用の最小実装へキャストしている
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions
        const fsDeps = {
            readdirSync: () => [{ name: 'mixed', isDirectory: () => true }],
            readFileSync: (p: string) => files.get(p) ?? '',
            existsSync: (p: string) => files.has(p),
            statSync: () => ({}),
        } as unknown as BuildSymbolMapFsDeps;

        const result = buildSymbolMap('/core/src', fsDeps);

        expect(result).toHaveLength(1);
        expect(result[0].modules).toEqual([
            { path: 'mixed/a.ts', symbols: ['A'] },
            { path: 'mixed/b', symbols: ['B'] }, // b.ts は fsDeps に存在しないため未解決パスのフォールバック表記
        ]);
    });
});

describe('formatMarkdownSummary', () => {
    it('[T-14] 層ごとのモジュール数・シンボル数が表形式に集計されること', () => {
        const md = formatMarkdownSummary([
            {
                layer: 'utilities',
                modules: [{ path: 'a.ts', symbols: ['A', 'B'] }],
            },
            { layer: 'dto', modules: [] },
        ]);

        expect(md).toContain('| `utilities` | 1 | 2 |');
        expect(md).toContain('| `dto` | 0 | 0 |');
    });
});
