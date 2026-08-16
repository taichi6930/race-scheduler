/**
 * generate-layer-dependency-graph.ts の自己テスト
 *
 * scripts/ は C0/C1 100% 義務の対象外（testing-conventions.md §7.5）だが、
 * レイヤー判定・パス解決を誤ると誤った依存グラフを生成してしまうため、
 * 純粋関数（fs非依存）のUTを用意する。
 *
 * ## デシジョンテーブル
 *
 * ### extractRelativeImports
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-01 | `import { X } from '../usecase/x'` | `['../usecase/x']` を含む |
 * | T-02 | パッケージ名からのimport（`@race-schedule/core`） | 抽出されない |
 *
 * ### classifyLayer
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-03 | `controller/fooController.ts` | 'controller' |
 * | T-04 | `usecase/implement/barUsecase.ts` | 'usecase' |
 * | T-05 | `utility/helper.ts`（層外） | null |
 *
 * ### resolveImportPath
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-06 | from='controller/fooController.ts', spec='../usecase/barUsecase' | 'usecase/barUsecase' |
 *
 * ### buildLayerEdges / toMermaid
 * | # | 入力 | 期待 |
 * |---|-----|------|
 * | T-07 | controller→usecase の依存1件 | エッジ1件、count=1 |
 * | T-08 | 同一レイヤー内の依存 | エッジに含まれない |
 * | T-09 | 同じレイヤーペアへの依存2件 | count=2に集約される |
 * | T-10 | toMermaidの出力 | flowchart記法・エッジ行を含む |
 */
import { describe, expect, it } from 'bun:test';

import {
    buildLayerEdges,
    classifyLayer,
    extractRelativeImports,
    resolveImportPath,
    toMermaid,
} from './generate-layer-dependency-graph';

describe('extractRelativeImports', () => {
    it('[T-01] 相対importの指定子を抽出すること', () => {
        expect(
            extractRelativeImports("import { X } from '../usecase/x';"),
        ).toEqual(['../usecase/x']);
    });

    it('[T-02] パッケージ名からのimportは抽出しないこと', () => {
        expect(
            extractRelativeImports("import { Y } from '@race-schedule/core';"),
        ).toEqual([]);
    });
});

describe('classifyLayer', () => {
    it("[T-03] controller配下は'controller'を返すこと", () => {
        expect(classifyLayer('controller/fooController.ts')).toBe('controller');
    });

    it("[T-04] usecase配下（ネスト有り）は'usecase'を返すこと", () => {
        expect(classifyLayer('usecase/implement/barUsecase.ts')).toBe(
            'usecase',
        );
    });

    it('[T-05] 層フォルダ外はnullを返すこと', () => {
        expect(classifyLayer('utility/helper.ts')).toBeNull();
    });
});

describe('resolveImportPath', () => {
    it('[T-06] 相対importをsrc相対パスへ解決すること', () => {
        expect(
            resolveImportPath(
                'controller/fooController.ts',
                '../usecase/barUsecase',
            ),
        ).toBe('usecase/barUsecase');
    });
});

describe('buildLayerEdges / toMermaid', () => {
    it('[T-07] controller→usecaseの依存を1件のエッジとして検出すること', () => {
        const files = [
            {
                srcRelativePath: 'controller/fooController.ts',
                content: "import { X } from '../usecase/barUsecase';",
            },
        ];
        expect(buildLayerEdges(files)).toEqual([
            { from: 'controller', to: 'usecase', count: 1 },
        ]);
    });

    it('[T-08] 同一レイヤー内の依存はエッジに含めないこと', () => {
        const files = [
            {
                srcRelativePath: 'usecase/implement/fooUsecase.ts',
                content: "import { X } from '../interface/IFooUsecase';",
            },
        ];
        expect(buildLayerEdges(files)).toEqual([]);
    });

    it('[T-09] 同じレイヤーペアへの依存は件数へ集約されること', () => {
        const files = [
            {
                srcRelativePath: 'controller/fooController.ts',
                content:
                    "import { X } from '../usecase/barUsecase';\nimport { Y } from '../usecase/bazUsecase';",
            },
        ];
        expect(buildLayerEdges(files)).toEqual([
            { from: 'controller', to: 'usecase', count: 2 },
        ]);
    });

    it('[T-10] Mermaid flowchart記法でエッジ行を出力すること', () => {
        const md = toMermaid('api', [
            { from: 'controller', to: 'usecase', count: 3 },
        ]);
        expect(md).toContain('flowchart LR');
        expect(md).toContain('controller -->|3| usecase');
    });
});
