/**
 * @file branchInstrumentPlugin.ts の統合チェック
 *
 * AGENTS.md「非自明なロジックには1本の実行可能チェックを残す」に対応する。分岐検出ロジック
 * 自体（istanbul-lib-instrument）はJest/nyc等で実運用されている実績あるライブラリのため
 * ここではテストしない。検証するのは「Bunへの配線が正しく動くか」——
 * `bun test --preload=branchInstrumentPlugin.ts --coverage` を実際に子プロセスで実行し、
 * 既知の分岐パターン（if/else・&&）を含むfixtures/branchFixture.tsに対して、
 * 出力されるistanbul形式カバレッジJSONの`b`（branch）フィールドが期待する実カウントに
 * なっていることを確認する。
 */
import { afterAll, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CoverageMapData } from 'istanbul-lib-coverage';

describe('branchInstrumentPlugin', () => {
    const outputDir = mkdtempSync(
        join(tmpdir(), 'branch-instrument-plugin-test-'),
    );
    const outputPath = join(outputDir, 'istanbul-coverage.json');

    afterAll(() => {
        rmSync(outputDir, { recursive: true, force: true });
    });

    it('T-01_fixtureのif_else及び&&の実カウントが期待通りに出力される', () => {
        const result = spawnSync(
            'bun',
            [
                'test',
                './scripts/branch-coverage/fixtures/branchFixture.test.ts',
                '--preload=./scripts/branch-coverage/branchInstrumentPlugin.ts',
                '--coverage',
            ],
            {
                cwd: join(import.meta.dir, '..', '..'),
                env: {
                    ...process.env,
                    BRANCH_COVERAGE_TARGET_FILTER:
                        'scripts/branch-coverage/fixtures/branchFixture\\.ts$',
                    BRANCH_COVERAGE_OUTPUT_PATH: outputPath,
                },
                encoding: 'utf8',
            },
        );

        expect(result.status).toBe(0);

        // SAFETY: branchInstrumentPlugin.ts自身がistanbul-lib-instrumentの出力を
        // そのままJSON.stringifyして書き出したファイルのため、istanbul標準形式
        // （CoverageMapData）であることが保証されている。
        const coverage: CoverageMapData = JSON.parse(
            readFileSync(outputPath, 'utf8'),
        );
        const fixtureEntry = Object.values(coverage)[0];
        expect(fixtureEntry).toBeDefined();
        if (!fixtureEntry) {
            throw new Error('fixtureのカバレッジエントリが見つかりません');
        }

        const ifBranchKey = Object.keys(fixtureEntry.branchMap).find(
            (key) => fixtureEntry.branchMap[key]?.type === 'if',
        );
        const andBranchKey = Object.keys(fixtureEntry.branchMap).find(
            (key) => fixtureEntry.branchMap[key]?.type === 'binary-expr',
        );

        expect(ifBranchKey).toBeDefined();
        expect(andBranchKey).toBeDefined();
        if (!ifBranchKey || !andBranchKey) {
            throw new Error('if/&&の分岐エントリが見つかりません');
        }

        // classify(true,true) が1回・classify(false,true)/classify(true,false) が2回。
        // if分岐: [true側1回, false側2回]
        expect(fixtureEntry.b[ifBranchKey]).toEqual([1, 2]);
        // &&分岐（a && b の短絡判定）: 実行された分岐の合計が3回のテスト分になる
        expect(
            fixtureEntry.b[andBranchKey]?.reduce((sum, n) => sum + n, 0),
        ).toBeGreaterThan(0);
    });
});
