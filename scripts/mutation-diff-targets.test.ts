/**
 * mutation-diff-targets.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * `--mutate` CLIがconfigのmutate配列を丸ごと上書きする関係で除外ルールを
 * 手動再現しており、誤って実装すると「除外すべきindex.ts等がPRごとに
 * ミューテーション対象になり続ける」「本来対象のファイルが常に無視される」
 * といった不具合に直結するため、UTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### isMutationTarget
 * | # | ファイル | パッケージ | 期待 |
 * |---|---------|-----------|------|
 * | T-01 | packages/core/src/utilities/chunk.ts | core | true（通常src） |
 * | T-02 | packages/core/src/index.ts | core | false（index.ts） |
 * | T-03 | packages/core/src/constants/foo.ts | core | false（constants/配下） |
 * | T-04 | packages/core/src/types/foo.ts | core | false（types/配下） |
 * | T-05 | packages/api/src/openapi/openApiSpec.ts | api | false（api限定でopenapi/除外） |
 * | T-06 | packages/admin/src/openapi/foo.ts | admin | true（openapi除外はapi限定） |
 * | T-07 | packages/core/test/unittest/foo.test.ts | core | false（test/配下はsrcでない） |
 * | T-08 | packages/admin/src/foo.ts | core | false（他パッケージのファイル） |
 * | T-09 | packages/core/src/foo.md | core | false（.ts以外） |
 *
 * ### groupMutationTargets
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-10 | core/adminに対象ファイルが混在 | 両方のキーにそれぞれ分類される |
 * | T-11 | 対象ファイルが1件も無いパッケージ | キー自体が出力に含まれない |
 * | T-12 | 空配列 | 空オブジェクト |
 */
import { describe, expect, it } from 'bun:test';

import {
    groupMutationTargets,
    isMutationTarget,
    MUTATION_PACKAGES,
} from './mutation-diff-targets';

describe('mutation-diff-targets', () => {
    describe('isMutationTarget', () => {
        it('T-01: 通常のsrcファイルはtrueを返す', () => {
            expect(
                isMutationTarget(
                    'packages/core/src/utilities/chunk.ts',
                    'core',
                ),
            ).toBe(true);
        });

        it('T-02: index.tsはfalseを返す', () => {
            expect(isMutationTarget('packages/core/src/index.ts', 'core')).toBe(
                false,
            );
        });

        it('T-03: constants/配下はfalseを返す', () => {
            expect(
                isMutationTarget('packages/core/src/constants/foo.ts', 'core'),
            ).toBe(false);
        });

        it('T-04: types/配下はfalseを返す', () => {
            expect(
                isMutationTarget('packages/core/src/types/foo.ts', 'core'),
            ).toBe(false);
        });

        it('T-05: apiのopenapi/配下はfalseを返す', () => {
            expect(
                isMutationTarget(
                    'packages/api/src/openapi/openApiSpec.ts',
                    'api',
                ),
            ).toBe(false);
        });

        it('T-06: openapi除外はapi限定で他パッケージには適用されない', () => {
            expect(
                isMutationTarget('packages/admin/src/openapi/foo.ts', 'admin'),
            ).toBe(true);
        });

        it('T-07: test/配下はfalseを返す', () => {
            expect(
                isMutationTarget(
                    'packages/core/test/unittest/foo.test.ts',
                    'core',
                ),
            ).toBe(false);
        });

        it('T-08: 他パッケージのファイルはfalseを返す', () => {
            expect(isMutationTarget('packages/admin/src/foo.ts', 'core')).toBe(
                false,
            );
        });

        it('T-09: .ts以外の拡張子はfalseを返す', () => {
            expect(isMutationTarget('packages/core/src/foo.md', 'core')).toBe(
                false,
            );
        });
    });

    describe('groupMutationTargets', () => {
        it('T-10: 複数パッケージの対象ファイルがそれぞれ分類される', () => {
            const result = groupMutationTargets([
                'packages/core/src/foo.ts',
                'packages/admin/src/bar.ts',
                'packages/core/src/index.ts',
            ]);

            expect(result).toEqual({
                core: ['packages/core/src/foo.ts'],
                admin: ['packages/admin/src/bar.ts'],
            });
        });

        it('T-11: 対象ファイルが1件も無いパッケージはキーが含まれない', () => {
            const result = groupMutationTargets(['packages/core/src/foo.ts']);

            expect(Object.keys(result)).toEqual(['core']);
            expect(result.batch).toBeUndefined();
        });

        it('T-12: 空配列を渡すと空オブジェクトを返す', () => {
            expect(groupMutationTargets([])).toEqual({});
        });
    });

    it('MUTATION_PACKAGESはcore/admin/batch/apiの4種のみ', () => {
        expect(MUTATION_PACKAGES).toEqual(['core', 'admin', 'batch', 'api']);
    });
});
