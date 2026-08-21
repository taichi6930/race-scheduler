#!/usr/bin/env bun
/**
 * check-pkg-label-sync.ts (QSYNC-08)
 *
 * `pkg:*` ラベルの対象パッケージ一覧は `.github/workflows/pull_request.yml`
 * （`detect-changed-packages` ジョブの「Sync pkg:* labels with changed packages」
 * ステップが持つ `for pkg in ...; do` ループ）と `scripts/release/packageLabels.ts`
 * （`PACKAGE_LAYERS`）の2箇所で二重管理されている（`.claude/docs/ci-conventions.md`
 * 参照）。片方だけ更新すると、ラベルは付くのにリリースノートのプレフィックスが
 * 出ない（またはその逆）という部分的に壊れた状態になる。両者のパッケージ名一覧が
 * 一致することを機械的に検証する。
 *
 * 使い方: bun scripts/check-pkg-label-sync.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PACKAGE_LAYERS } from './release/packageLabels';

const WORKFLOW_PATH = join(
    import.meta.dir,
    '../.github/workflows/pull_request.yml',
);

/**
 * pull_request.yml の「Sync pkg:* labels with changed packages」ステップが持つ
 * `for pkg in admin api ...; do` ループから、対象パッケージ名一覧を抽出する。
 * @param workflowContent - pull_request.yml の内容
 * @returns パッケージ名一覧（昇順ソート、重複除去）。ループ行が見つからなければ空配列
 */
export const extractWorkflowLayers = (workflowContent: string): string[] => {
    const match = /for pkg in ([a-z ]+); do/.exec(workflowContent);
    if (!match) return [];
    return [...new Set(match[1].trim().split(/\s+/))].sort();
};

export interface LayerDiff {
    /** pull_request.yml のみに存在するパッケージ名 */
    onlyInWorkflow: string[];
    /** packageLabels.ts (PACKAGE_LAYERS) のみに存在するパッケージ名 */
    onlyInTs: string[];
}

/**
 * workflow側・TS側それぞれのパッケージ名一覧を突き合わせ、片方にしか無いものを抽出する。
 * @param workflowLayers - {@link extractWorkflowLayers} の抽出結果
 * @param tsLayers - `PACKAGE_LAYERS` の一覧
 * @returns 片方にしか存在しないパッケージ名（両方に無ければ空配列同士）
 */
export const diffPackageLayers = (
    workflowLayers: readonly string[],
    tsLayers: readonly string[],
): LayerDiff => ({
    onlyInWorkflow: workflowLayers.filter((layer) => !tsLayers.includes(layer)),
    onlyInTs: tsLayers.filter((layer) => !workflowLayers.includes(layer)),
});

if (import.meta.main) {
    const workflowContent = readFileSync(WORKFLOW_PATH, 'utf-8');
    const workflowLayers = extractWorkflowLayers(workflowContent);
    const tsLayers: string[] = [...PACKAGE_LAYERS].sort();
    const { onlyInWorkflow, onlyInTs } = diffPackageLayers(
        workflowLayers,
        tsLayers,
    );

    if (onlyInWorkflow.length > 0 || onlyInTs.length > 0) {
        console.error('❌ pkg:* ラベル対象パッケージの一覧が不一致です:');
        if (onlyInWorkflow.length > 0) {
            console.error(
                `  pull_request.yml のみに存在: ${onlyInWorkflow.join(', ')}`,
            );
        }
        if (onlyInTs.length > 0) {
            console.error(
                `  packageLabels.ts (PACKAGE_LAYERS) のみに存在: ${onlyInTs.join(', ')}`,
            );
        }
        console.error(
            '  .claude/docs/ci-conventions.md の「PRの pkg:* 自動ラベル」節に従い、両方を更新してください。',
        );
        process.exit(1);
    }

    console.log(
        `✅ pkg:* ラベル対象パッケージ一覧が一致しています（${tsLayers.join(', ')}）`,
    );
}
