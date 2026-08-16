#!/usr/bin/env bun
/**
 * check-wrangler-config.ts (CFARCH-02)
 *
 * `wrangler.toml` の設定警告をCIで検知し、非継承キーの再発を防ぐ。
 *
 * 背景: `[[ratelimits]]` 等のバインディング系キーは `wrangler` の仕様上
 * named environment（`[env.production]` 等）へ継承されない。`wrangler deploy
 * --dry-run` はこの不整合を警告として標準エラー出力に出すが、**警告のみで
 * 終了コードは0のまま**のため、CI・手動デプロイのどちらでも誰にも気づかれず、
 * 本番を含む全環境でレート制限が無効化される事故（CFARCH-01）が実際に発生した。
 *
 * db パッケージは `main`（デプロイされるWorkerスクリプト）を持たない
 * マイグレーション専用パッケージのため対象外（CFARCH-01と同じ判定基準）。
 *
 * 使い方:
 *   bun scripts/check-wrangler-config.ts
 *   （`bun install` 済みであること。実際の認証情報は不要 — `${CLOUDFLARE_ACCOUNT_ID}`
 *   等のプレースホルダはスクリプト内でダミー値に置換する）
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** デプロイされるWorkerを持つパッケージ（dbはマイグレーション専用のため対象外） */
const PACKAGES = ['admin', 'api', 'batch'] as const;

/** wrangler.tomlが実際にデプロイで使う環境（`local`は`wrangler dev`専用のため対象外） */
const ENVIRONMENTS = ['development', 'test', 'production'] as const;

/** CI用ダミー値。dry-runのバンドル・設定検証には実際の値は不要。 */
const PLACEHOLDER_REPLACEMENTS: readonly (readonly [string, string])[] = [
    ['${CLOUDFLARE_ACCOUNT_ID}', '0123456789abcdef0123456789abcdef'],
    ['${DB_ID}', '11111111-2222-3333-4444-555555555555'],
];

/**
 * `wrangler.toml` の内容に含まれるプレースホルダをCI用ダミー値へ置換する。
 * @param tomlContent - 置換前の `wrangler.toml` 内容
 * @returns 置換後の内容
 */
export function resolvePlaceholders(tomlContent: string): string {
    return PLACEHOLDER_REPLACEMENTS.reduce(
        (content, [placeholder, value]) =>
            content.split(placeholder).join(value),
        tomlContent,
    );
}

/**
 * `wrangler deploy --dry-run` の出力（標準エラー出力）に、バインディング系キーが
 * named environment へ継承されない設定警告が含まれるかを判定する。
 * @param output - `wrangler deploy --dry-run` の標準エラー出力
 * @returns 検知した警告メッセージの一覧（無ければ空配列）
 */
export function findInheritanceWarnings(output: string): string[] {
    return output
        .split('\n')
        .filter((line) => line.includes('is not inherited by environments'))
        .map((line) => line.trim());
}

/**
 * `wrangler.toml` の内容からトップレベルの `compatibility_date` の値を抽出する
 * （QSYNC-06）。`compatibility_date` はバインディング系キーと異なり named
 * environment へ継承されるため、トップレベルの1箇所のみを見れば足りる。
 * @param tomlContent - `wrangler.toml` の内容
 * @returns 抽出した日付文字列。見つからない場合は null
 */
export function extractCompatibilityDate(tomlContent: string): string | null {
    const match = /^compatibility_date\s*=\s*"([^"]+)"/m.exec(tomlContent);
    return match ? match[1] : null;
}

/**
 * パッケージ別の `compatibility_date` 一覧から、値が割れている（全パッケージで
 * 一致していない）かを判定する。
 *
 * `.claude/docs/ci-conventions.md`（PERF-141）が「5パッケージで同じ日付に揃える」
 * ことを規約として明文化しているが機械チェックが無かった。不一致だとWorker間で
 * ランタイム挙動が異なり、「どのWorkerを経由したか」に依存する再現条件の
 * バグを生む（QSYNC-06）。
 * @param dates - パッケージ名と `compatibility_date` のペア一覧
 * @returns 不一致メッセージの一覧（一致していれば空配列）
 */
export function findCompatibilityDateMismatches(
    dates: readonly (readonly [string, string | null])[],
): string[] {
    const uniqueDates = new Set(dates.map(([, date]) => date));
    if (uniqueDates.size <= 1) return [];

    return dates.map(
        ([pkg, date]) =>
            `packages/${pkg}/wrangler.toml: compatibility_date = ${date ?? '(見つかりません)'}`,
    );
}

interface DryRunTarget {
    pkg: (typeof PACKAGES)[number];
    env: (typeof ENVIRONMENTS)[number];
}

interface DryRunResult extends DryRunTarget {
    warnings: string[];
}

/**
 * 1パッケージ・1環境に対して `wrangler deploy --dry-run` を実行し、
 * 設定警告を検知する。
 *
 * `wrangler` は非継承キーの警告があっても正常終了（exit 0）するため
 * （CFARCH-01がまさにこの理由で長期間気づかれなかった）、終了コードでは
 * 判定できない。`execFileSync` は成功時に標準エラー出力を返さないため、
 * 成功・失敗を問わず標準エラー出力を取得できる `spawnSync` を使う。
 * @param repoRoot - リポジトリルートの絶対パス
 * @param target - 対象パッケージ・環境
 * @returns 検知結果
 */
function checkOne(repoRoot: string, target: DryRunTarget): DryRunResult {
    const pkgDir = join(repoRoot, 'packages', target.pkg);
    const originalPath = join(pkgDir, 'wrangler.toml');
    const tempPath = join(pkgDir, '.tmp-check-wrangler-config.toml');

    const original = readFileSync(originalPath, 'utf8');
    writeFileSync(tempPath, resolvePlaceholders(original));

    try {
        const result = spawnSync(
            'bunx',
            [
                'wrangler',
                'deploy',
                '--dry-run',
                '--env',
                target.env,
                '--config',
                tempPath,
                '--outdir',
                join(tmpdir(), 'check-wrangler-config-dry-run-out'),
            ],
            { cwd: pkgDir, encoding: 'utf8' },
        );
        const stderr = result.stderr ?? '';
        return { ...target, warnings: findInheritanceWarnings(stderr) };
    } finally {
        unlinkSync(tempPath);
    }
}

if (import.meta.main) {
    const repoRoot = join(import.meta.dir, '..');
    const targets: DryRunTarget[] = PACKAGES.flatMap((pkg) =>
        ENVIRONMENTS.map((env) => ({ pkg, env })),
    );

    const results = targets.map((target) => checkOne(repoRoot, target));
    const withWarnings = results.filter((r) => r.warnings.length > 0);

    const compatibilityDates = PACKAGES.map(
        (pkg) =>
            [
                pkg,
                extractCompatibilityDate(
                    readFileSync(
                        join(repoRoot, 'packages', pkg, 'wrangler.toml'),
                        'utf8',
                    ),
                ),
            ] as const,
    );
    const dateMismatches = findCompatibilityDateMismatches(compatibilityDates);

    if (withWarnings.length > 0 || dateMismatches.length > 0) {
        if (withWarnings.length > 0) {
            console.log(
                '❌ wrangler.toml に設定警告があります（named environment への非継承キー）:',
            );
            for (const { pkg, env, warnings } of withWarnings) {
                for (const warning of warnings) {
                    console.log(
                        `   - packages/${pkg} [env.${env}]: ${warning}`,
                    );
                }
            }
            console.log(
                '\nバインディング系キー（[[ratelimits]] 等）は、[env.X] ブロックごとに複製してください（CFARCH-01参照）。',
            );
        }

        if (dateMismatches.length > 0) {
            console.log(
                '❌ wrangler.toml のcompatibility_dateがパッケージ間で不一致です:',
            );
            for (const mismatch of dateMismatches) {
                console.log(`   - ${mismatch}`);
            }
            console.log(
                '\n5パッケージで同じ日付に揃えてください（.claude/docs/ci-conventions.md参照）。',
            );
        }

        process.exit(1);
    }

    console.log(
        `✅ ${PACKAGES.length}パッケージ × ${ENVIRONMENTS.length}環境、wrangler設定警告なし・compatibility_date一致`,
    );
}
