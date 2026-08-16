#!/usr/bin/env bun
/**
 * check-pkg-label-sync.ts (QSYNC-08)
 *
 * `pkg:*` ラベルの対象パッケージ一覧は `.github/workflows/pull_request.yml`
 * （`detect-changed-packages` ジョブのラベル同期ステップが使う `filter` 出力）と
 * `scripts/release/packageLabels.ts`（`PACKAGE_LAYERS`）の2箇所で二重管理されている
 * （`.claude/docs/ci-conventions.md` 参照）。片方だけ更新すると、ラベルは付くのに
 * リリースノートのプレフィックスが出ない（またはその逆）という部分的に壊れた状態になる。
 * 両者のパッケージ名一覧が一致することを機械的に検証する。
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

const extractWorkflowLayers = (workflowContent: string): string[] => {
    const matches = workflowContent.matchAll(/^\s*layer-([a-z]+):/gm);
    return [...new Set([...matches].map((match) => match[1]))].sort();
};

const workflowContent = readFileSync(WORKFLOW_PATH, 'utf-8');
const workflowLayers = extractWorkflowLayers(workflowContent);
const tsLayers: string[] = [...PACKAGE_LAYERS].sort();

const onlyInWorkflow = workflowLayers.filter(
    (layer) => !tsLayers.includes(layer),
);
const onlyInTs = tsLayers.filter((layer) => !workflowLayers.includes(layer));

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
