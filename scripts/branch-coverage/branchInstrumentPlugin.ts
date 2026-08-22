/**
 * @file 分岐カバレッジ（C1）計測用のBun plugin
 *
 * `bun test --coverage`のlcov出力にはBRDA（分岐）レコードが含まれず、
 * testing-conventions.md §7.5の「C1」は実際には行カバレッジに過ぎない
 * （aidlc-docs/inception/application-design/branch-coverage-instrumentation-design.md 参照）。
 *
 * BunはV8ではなくJavaScriptCoreで動くため、c8/monocart-coverage-reports等の
 * V8ネイティブカバレッジ系ツールは使えない。一方 `istanbul-lib-instrument`
 * （Jest/nyc内部で使われるコア計装ライブラリ）はエンジン非依存のソースAST変換のため
 * Bunでも動作する。このpluginはBunの`onLoad`フックでソースを横取りしistanbul計装を通し、
 * `bun:test`の`afterAll`（本ファイルがpreloadされることでグローバルに1回登録される）で
 * `global.__coverage__`をJSONに書き出す。
 *
 * 使い方: `bun --config=bunfig.branch-coverage.toml test packages/PKG/test/unittest --coverage`
 * （`bun run test:branch-coverage` が実行する。既定の`bun run test`では読み込まれない。
 * 対象は TS ソースを持つ全パッケージ（admin/api/batch/core、front はFlutter、dbはsrc無しのため対象外））
 *
 * 本ファイルと対応するテストファイルは `knip.json` の `ignore` に含めている。本ファイルは
 * `bunfig.branch-coverage.toml` の `preload` からのみ参照されるためJS importグラフ上は
 * 未使用に見え、テストファイルは `spawnSync('bun', ['test', ...])` を含むため
 * knipのbun-testプラグインが誤って無関係な `scripts/filter-coverage-report.ts` を
 * 未解決importとして誤検知する（実機確認済み）。
 */

import { afterAll } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { plugin } from 'bun';
import type { CoverageMapData } from 'istanbul-lib-coverage';
import { createInstrumenter } from 'istanbul-lib-instrument';

// istanbul-lib-instrument が計装したコードがテスト実行中に書き込むグローバル変数。
// `globalThis as unknown as {...}` のような型アサーションを避けるための素直なambient宣言
// （TSのglobal augmentationはvar宣言のみ許可される）。
declare global {
    // biome-ignore lint/suspicious/noVar: TSのglobal augmentationはvar宣言のみ許可される
    var __coverage__: CoverageMapData | undefined;
}

// 環境変数での上書きは branchInstrumentPlugin.test.ts が、実際のpackages/*/srcを
// 汚さずフィクスチャファイルに対して統合チェックを行うためだけに使う。
// 既定はTSソースを持つ全パッケージ（front はFlutter、db はsrc無しのため自然に対象外）。
export const COVERAGE_TARGET_FILTER = process.env.BRANCH_COVERAGE_TARGET_FILTER
    ? new RegExp(process.env.BRANCH_COVERAGE_TARGET_FILTER)
    : /packages\/[^/]+\/src\/.*\.ts$/;
export const COVERAGE_OUTPUT_PATH =
    process.env.BRANCH_COVERAGE_OUTPUT_PATH ??
    './coverage/istanbul-coverage.json';

const instrumenter = createInstrumenter({
    esModules: true,
    compact: false,
    parserPlugins: ['typescript'],
});

plugin({
    name: 'istanbul-branch-instrument',
    setup(build) {
        build.onLoad({ filter: COVERAGE_TARGET_FILTER }, (args) => {
            const source = readFileSync(args.path, 'utf8');
            try {
                const instrumented = instrumenter.instrumentSync(
                    source,
                    args.path,
                );
                return { contents: instrumented, loader: 'ts' };
            } catch (error) {
                // 設計書§5のリスク軽減策: 計装失敗時はCIを落とさず素通しする
                console.error(
                    `[branchInstrumentPlugin] ${args.path} の計装に失敗したため未計装のまま読み込みます:`,
                    error,
                );
                return { contents: source, loader: 'ts' };
            }
        });
    },
});

afterAll(() => {
    const coverage = globalThis.__coverage__;
    mkdirSync(dirname(COVERAGE_OUTPUT_PATH), { recursive: true });
    writeFileSync(
        COVERAGE_OUTPUT_PATH,
        JSON.stringify(coverage ?? {}, null, 2),
    );
});
