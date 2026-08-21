/**
 * check-pkg-label-sync.ts の自己テスト（QSYNC-08）
 *
 * ## デシジョンテーブル
 *
 * ### extractWorkflowLayers
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-01 | `for pkg in ...; do` 行が存在する | パッケージ名一覧を昇順ソートで抽出 |
 * | T-02 | `for pkg in ...; do` 行が存在しない | 空配列 |
 *
 * ### diffPackageLayers
 * | # | 条件 | 期待 |
 * |---|------|------|
 * | T-03 | 両方の一覧が完全一致 | onlyInWorkflow/onlyInTs ともに空配列 |
 * | T-04 | workflow側のみに余分なパッケージがある | onlyInWorkflow に該当パッケージ |
 * | T-05 | ts側のみに余分なパッケージがある | onlyInTs に該当パッケージ |
 */

import { describe, expect, it } from 'bun:test';

import {
    diffPackageLayers,
    extractWorkflowLayers,
} from './check-pkg-label-sync';

describe('check-pkg-label-sync/extractWorkflowLayers', () => {
    it('T-01: for pkg in 行からパッケージ名一覧を昇順ソートで抽出すること', () => {
        const workflow = `
          for pkg in admin api batch core db front; do
            label="pkg:$pkg"
`;

        const layers = extractWorkflowLayers(workflow);

        expect(layers).toEqual([
            'admin',
            'api',
            'batch',
            'core',
            'db',
            'front',
        ]);
    });

    it('T-02: for pkg in 行が存在しない場合は空配列を返すこと', () => {
        const workflow = 'name: pull_request\n';

        const layers = extractWorkflowLayers(workflow);

        expect(layers).toEqual([]);
    });
});

describe('check-pkg-label-sync/diffPackageLayers', () => {
    it('T-03: 両方の一覧が完全一致する場合は両方とも空配列を返すこと', () => {
        const diff = diffPackageLayers(['admin', 'api'], ['admin', 'api']);

        expect(diff).toEqual({ onlyInWorkflow: [], onlyInTs: [] });
    });

    it('T-04: workflow側のみに余分なパッケージがあれば onlyInWorkflow に含めること', () => {
        const diff = diffPackageLayers(
            ['admin', 'api', 'scraping'],
            ['admin', 'api'],
        );

        expect(diff).toEqual({ onlyInWorkflow: ['scraping'], onlyInTs: [] });
    });

    it('T-05: ts側のみに余分なパッケージがあれば onlyInTs に含めること', () => {
        const diff = diffPackageLayers(['admin'], ['admin', 'db']);

        expect(diff).toEqual({ onlyInWorkflow: [], onlyInTs: ['db'] });
    });
});
