#!/usr/bin/env bun
/**
 * check-deploy-working-dirs.ts
 *
 * `deploy-*-reusable.yml` の `working-directory: packages/X` で指定された
 * ディレクトリに `wrangler.toml` が実在するかを検証する（読み取り専用）。
 *
 * 背景（2026-08-08、packages/admin実例）: `.gitignore`の`wrangler.toml`パターン
 * （envsubstによる書き換えをgit差分から除外するためのルール。他パッケージは
 * `git add -f`で個別に追跡済み）により、新規パッケージ追加時に force-add を
 * 忘れると、ファイルがコミットされないままPRがマージされる。CI（`bun install`や
 * 型チェック等）はこの欠落を検知できず、実際にproduction/testへデプロイする
 * `deploy-admin`ジョブの`wrangler`コマンド実行時になって初めて
 * 「Required Worker name missing」という分かりにくいエラーで失敗し、
 * 本番反映が止まっていた。
 *
 * 使い方:
 *   bun scripts/check-deploy-working-dirs.ts
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

interface WorkflowStep {
    uses?: string;
    with?: Record<string, unknown>;
}

interface WorkflowJob {
    steps?: WorkflowStep[];
}

interface WorkflowFile {
    jobs?: Record<string, WorkflowJob>;
}

/**
 * ワークフローYAMLから、`deploy-cloudflare-workers`アクション呼び出しの
 * `working-directory`を抽出する。`wrangler`コマンドを実行しないステップ
 * （front の Cloudflare Pages デプロイ等）は対象外にするため、YAML構造上
 * `uses`が`deploy-cloudflare-workers`のステップに限定する（正規表現による
 * 全文検索だと front 等のPages系working-directoryも誤検知するため）。
 * @param workflowContent - `deploy-*-reusable.yml` の内容
 * @returns 重複を除いた `packages/X` 形式のパス一覧
 */
export function extractWorkingDirectories(workflowContent: string): string[] {
    const doc = parse(workflowContent) as WorkflowFile;
    const dirs = new Set<string>();
    for (const job of Object.values(doc.jobs ?? {})) {
        for (const step of job.steps ?? []) {
            if (!step.uses?.includes('deploy-cloudflare-workers')) continue;
            const dir = step.with?.['working-directory'];
            if (typeof dir === 'string') dirs.add(dir);
        }
    }
    return [...dirs];
}

/**
 * `working-directory` ごとに `wrangler.toml` が実在するかを判定する。
 * @param workingDirectories - `extractWorkingDirectories` の出力
 * @param exists - パスの実在判定（テスト容易性のため注入可能にする）
 * @returns `wrangler.toml` が見つからなかった `packages/X` 一覧
 */
export function findMissingWranglerConfigs(
    workingDirectories: readonly string[],
    exists: (wranglerTomlPath: string) => boolean,
): string[] {
    return workingDirectories.filter(
        (dir) => !exists(join(dir, 'wrangler.toml')),
    );
}

if (import.meta.main) {
    const repoRoot = join(import.meta.dir, '..');
    const workflowsDir = join(repoRoot, '.github/workflows');
    const deployReusableFiles = readdirSync(workflowsDir).filter((f) =>
        /^deploy-.*-reusable\.yml$/.test(f),
    );

    const missing: { file: string; dir: string }[] = [];
    for (const file of deployReusableFiles) {
        const content = readFileSync(join(workflowsDir, file), 'utf8');
        const dirs = extractWorkingDirectories(content);
        const exists = (relPath: string): boolean =>
            existsSync(join(repoRoot, relPath));
        for (const dir of findMissingWranglerConfigs(dirs, exists)) {
            missing.push({ file, dir });
        }
    }

    if (missing.length > 0) {
        // eslint-disable-next-line no-console
        console.log('❌ デプロイに必要なwrangler.tomlが見つかりません:');
        for (const { file, dir } of missing) {
            // eslint-disable-next-line no-console
            console.log(`   - ${file}: ${dir}/wrangler.toml`);
        }
        // eslint-disable-next-line no-console
        console.log(
            '\n.gitignoreの`wrangler.toml`パターンによりforce-add（`git add -f <path>`）を忘れていないか確認してください。',
        );
        process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log('✅ デプロイ対象パッケージすべてにwrangler.tomlが存在します');
}
