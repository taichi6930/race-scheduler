/**
 * test-changed.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * 変更ファイル→テスト対象の解決ロジックを誤ると「変更したのにテストが
 * 実行されない」という無言のすり抜けが起きるため、UTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### unitTestPathFor
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-01 | `packages/core/src/utility/foo.ts` | `packages/core/test/unittest/utility/foo.test.ts` |
 * | T-02 | `packages/core/test/unittest/foo.test.ts`（既にtest配下） | undefined |
 *
 * ### componentTestDirFor
 * | # | 入力 | 期待 |
 * |---|------|------|
 * | T-03 | `packages/api/src/usecase/raceUsecase.ts` | `packages/api/test/integration/component` |
 * | T-04 | `packages/api/src/controller/raceController.ts` | `packages/api/test/integration/component` |
 * | T-05 | `packages/api/src/repository/raceRepository.ts`（対象外の層） | undefined |
 *
 * ### resolveTargets
 * | # | 変更ファイル | 実在するパス | 期待 |
 * |---|-------------|-------------|------|
 * | T-06 | 変更されたtestファイル自身 | 実在する | そのまま対象になる |
 * | T-07 | 変更されたtestファイル自身 | 実在しない（削除済み等） | 対象にならない |
 * | T-08 | usecaseのsrcファイル | UT・componentディレクトリとも実在 | 両方が対象になる |
 * | T-09 | test/src以外のファイル（docs等） | - | 対象にならない |
 * | T-10 | 複数ファイルで同じ対象に解決される | - | 重複除去され1件になる |
 */
import { describe, expect, it } from 'bun:test';

import {
    componentTestDirFor,
    resolveTargets,
    unitTestPathFor,
} from './test-changed';

describe('unitTestPathFor', () => {
    it('[T-01] srcファイルパス_対応するUTファイルパスを返す', () => {
        const result = unitTestPathFor('packages/core/src/utility/foo.ts');

        expect(result).toBe('packages/core/test/unittest/utility/foo.test.ts');
    });

    it('[T-02] 既にtest配下のパス_undefinedを返す', () => {
        const result = unitTestPathFor(
            'packages/core/test/unittest/foo.test.ts',
        );

        expect(result).toBeUndefined();
    });
});

describe('componentTestDirFor', () => {
    it('[T-03] usecase層のsrcファイル_コンポーネントテストディレクトリを返す', () => {
        const result = componentTestDirFor(
            'packages/api/src/usecase/raceUsecase.ts',
        );

        expect(result).toBe('packages/api/test/integration/component');
    });

    it('[T-04] controller層のsrcファイル_コンポーネントテストディレクトリを返す', () => {
        const result = componentTestDirFor(
            'packages/api/src/controller/raceController.ts',
        );

        expect(result).toBe('packages/api/test/integration/component');
    });

    it('[T-05] usecase_controller以外の層_undefinedを返す', () => {
        const result = componentTestDirFor(
            'packages/api/src/repository/raceRepository.ts',
        );

        expect(result).toBeUndefined();
    });
});

describe('resolveTargets', () => {
    it('[T-06] 変更されたtestファイル自身が実在する_そのまま対象になる', () => {
        const result = resolveTargets(
            ['packages/core/test/unittest/foo.test.ts'],
            () => true,
        );

        expect(result).toEqual(['packages/core/test/unittest/foo.test.ts']);
    });

    it('[T-07] 変更されたtestファイル自身が実在しない_対象にならない', () => {
        const result = resolveTargets(
            ['packages/core/test/unittest/foo.test.ts'],
            () => false,
        );

        expect(result).toEqual([]);
    });

    it('[T-08] usecaseのsrcファイル_UTとcomponentディレクトリ両方が対象になる', () => {
        const result = resolveTargets(
            ['packages/api/src/usecase/raceUsecase.ts'],
            () => true,
        );

        expect(result).toEqual([
            'packages/api/test/integration/component',
            'packages/api/test/unittest/usecase/raceUsecase.test.ts',
        ]);
    });

    it('[T-09] test_src以外のファイル_対象にならない', () => {
        const result = resolveTargets(['docs/tasks/BACKLOG.md'], () => true);

        expect(result).toEqual([]);
    });

    it('[T-10] 複数ファイルが同じ対象に解決される_重複除去され1件になる', () => {
        const result = resolveTargets(
            [
                'packages/api/src/usecase/raceUsecase.ts',
                'packages/api/src/controller/raceController.ts',
            ],
            (path) => path === 'packages/api/test/integration/component',
        );

        expect(result).toEqual(['packages/api/test/integration/component']);
    });
});
