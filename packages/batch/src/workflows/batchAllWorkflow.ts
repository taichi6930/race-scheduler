/**
 * batch-all.yml の Cloudflare ネイティブ Workflows 移行版（CICD-73）。
 *
 * 実処理はすべて `batchAllWorkflowLogic.ts` に集約している。本ファイルは
 * `cloudflare:workers`（Workers ランタイム固有の仮想モジュールで、
 * bun test 実行環境からは解決できない）に依存する `WorkflowEntrypoint` を
 * 継承する薄いエントリポイントに留めている（`cli.ts`/`batchCli.ts` と同じ
 * 分離方針）。そのため本ファイルは `bunfig.toml` の
 * `coveragePathIgnorePatterns` で除外している。
 */

import {
    WorkflowEntrypoint,
    type WorkflowEvent,
    type WorkflowStep,
} from 'cloudflare:workers';
import type { CloudFlareEnv } from '@race-schedule/core';

import type { BatchAllWorkflowPayload } from './batchAllWorkflowLogic';
import { runBatchAllWorkflow } from './batchAllWorkflowLogic';

/**
 * `batch-all.yml` の cron 起動、および `batch-race`/`batch-place`/
 * `batch-calendar.yml` の手動起動（CICD-73/CONC-03で統合）を置き換える Workflow。
 * payload省略時はcron相当（全raceType・全target）で実行する。
 */
export class BatchAllWorkflow extends WorkflowEntrypoint<
    CloudFlareEnv,
    BatchAllWorkflowPayload | null | undefined
> {
    async run(
        event: Readonly<
            WorkflowEvent<BatchAllWorkflowPayload | null | undefined>
        >,
        step: WorkflowStep,
    ): Promise<void> {
        await runBatchAllWorkflow(this.env, event, step);
    }
}
