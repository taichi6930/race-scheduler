#!/usr/bin/env bun
/**
 * check-workflow-hygiene.ts
 *
 * `.github/workflows/*.yml` を静的解析し、新しいジョブが増えたことのコストを可視化する
 * レポートを出す（CICD-56）。
 *
 * - ワークフロー全体のジョブ数をレポートする
 * - `timeout-minutes` が未設定のジョブを一覧する（既定 6 時間でハングし runner を専有し続ける）
 * - `bun install` を直接呼びつつ `actions/cache` ステップを持たないジョブを一覧する
 *
 * 既存ワークフロー（deploy系等）には`pull_request.yml`向けのCICD-47適用範囲外で
 * timeout-minutes未設定のジョブが元々多数あるため、このスクリプトはレポートのみで
 * 非ブロッキング（常に exit 0）とする。ブロッキング化するとこのタスクの範囲外の
 * 既存debtで無関係なPRのCIを壊してしまうため。
 *
 * 使い方:
 *   bun scripts/check-workflow-hygiene.ts
 */

/* eslint-disable no-console */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

const WORKFLOWS_DIR = '.github/workflows';

interface WorkflowStep {
    uses?: string;
    run?: string;
}

interface WorkflowJob {
    'timeout-minutes'?: number;
    steps?: WorkflowStep[];
}

interface WorkflowFile {
    jobs?: Record<string, WorkflowJob>;
}

/** 指定ディレクトリ内の `.yml`/`.yaml` ワークフローファイル名一覧を取得する */
const listWorkflowFiles = (dir: string): string[] =>
    readdirSync(dir)
        .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
        .sort();

/** ジョブがキャッシュ無しで `bun install` を直接呼んでいるかを判定する */
const isBunInstallWithoutCache = (job: WorkflowJob): boolean => {
    const steps = job.steps ?? [];
    const hasBareBunInstall = steps.some((step) =>
        step.run?.trim().startsWith('bun install'),
    );
    const hasCacheStep = steps.some((step) =>
        step.uses?.startsWith('actions/cache@'),
    );
    return hasBareBunInstall && !hasCacheStep;
};

let totalJobs = 0;
const missingTimeout: string[] = [];
const cacheLessJobs: string[] = [];

for (const file of listWorkflowFiles(WORKFLOWS_DIR)) {
    const path = join(WORKFLOWS_DIR, file);
    const content = readFileSync(path, 'utf-8');
    const doc = parse(content) as WorkflowFile;
    const jobs = doc.jobs ?? {};

    for (const [jobName, job] of Object.entries(jobs)) {
        totalJobs += 1;
        const label = `${file}:${jobName}`;
        if (job['timeout-minutes'] === undefined) {
            missingTimeout.push(label);
        }
        if (isBunInstallWithoutCache(job)) {
            cacheLessJobs.push(label);
        }
    }
}

console.log(`ワークフロー総ジョブ数: ${totalJobs}`);

if (cacheLessJobs.length > 0) {
    console.log(
        `ℹ️  bun installを直接呼びつつactions/cacheが無いジョブ（${cacheLessJobs.length}件）:\n  ${cacheLessJobs.join('\n  ')}`,
    );
}

if (missingTimeout.length > 0) {
    console.log(
        `ℹ️  timeout-minutesが未設定のジョブ（${missingTimeout.length}件、既定6時間でハング時にrunnerを専有）:\n  ${missingTimeout.join('\n  ')}`,
    );
} else {
    console.log('✅ 全ジョブにtimeout-minutesが設定されています。');
}
