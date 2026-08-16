#!/usr/bin/env bun
/**
 * check-secret-wiring.ts
 *
 * `packages/core/src/utilities/platform/cloudFlareEnv.ts` の string 型フィールドの
 * うち、ソースコードで実際に読まれている（`EnvStore.env.X` / `c.env.X` 等）ものが、
 * デプロイワークフロー（`.github/workflows/deploy*.yml`）・`wrangler.toml` の
 * いずれにも一切登場しない場合を検知する。
 *
 * 背景（feature-flag-design.md、ADMIN_TOKEN配線漏れ、PR #2377の追加修正）:
 * `CloudFlareEnv` へ新しい secret フィールドを追加してコードから読むところまでは
 * 実装したが、`deploy-*-reusable.yml` の `secrets-json`（wrangler secretとして
 * 実際にCloudflareへ反映する仕組み）への配線を書き忘れ、GitHub Secretsに値を
 * 設定しても実際のWorkerには反映されない、というバグが発生した。
 * `deploy-cloudflare-workers` action の「Verify worker secrets are live」ステップは
 * 「配線したキーが本当に届いたか」しか検証できず、「配線を忘れたキー」自体は
 * 検知できない。本スクリプトはPRの時点（マージ前）でこの配線漏れを検知する。
 *
 * ヒューリスティックであり完全ではない: フィールド名が `wrangler.toml`・デプロイ
 * ワークフローのどこかに文字列として登場するかを見るだけで、実際に正しい仕組み
 * （vars/envsubst/secrets-json）で配線されているかまでは検証しない。
 *
 * 使い方:
 *   bun scripts/check-secret-wiring.ts
 */

/* eslint-disable no-console */
import { readFileSync } from 'node:fs';

const CLOUDFLARE_ENV_PATH =
    'packages/core/src/utilities/platform/cloudFlareEnv.ts';

interface WiringGap {
    field: string;
}

/**
 * cloudFlareEnv.ts のソースから string 型フィールド名一覧を抽出する
 * （D1Database/R2Bucket/RateLimit/Workflow等のバインディング型は対象外）。
 * @param cloudFlareEnvSource cloudFlareEnv.ts の内容
 */
function extractStringFieldNames(cloudFlareEnvSource: string): string[] {
    const fieldPattern = /^\s*(\w+)\??:\s*string\s*;/gm;
    return [...cloudFlareEnvSource.matchAll(fieldPattern)].map(
        (match) => match[1],
    );
}

/**
 * 指定フィールド名一覧のうち、いずれかのソースファイル内容で
 * `.env.<フィールド名>`（`EnvStore.env.X` / `c.env.X` 等）として実際に
 * 読まれているものだけを返す。
 * @param fieldNames cloudFlareEnv.ts のフィールド名一覧
 * @param sourceFileContents ファイルパス→内容のマップ（`packages/*\/src` 配下想定）
 */
function extractReferencedFieldNames(
    fieldNames: string[],
    sourceFileContents: Record<string, string>,
): string[] {
    const allSource = Object.values(sourceFileContents).join('\n');
    return fieldNames.filter((name) => {
        const referencePattern = new RegExp(`\\.env\\.${name}\\b`);
        return referencePattern.test(allSource);
    });
}

/**
 * 実際に読まれているフィールド名一覧のうち、デプロイ設定
 * （`wrangler.toml`・`.github/workflows/deploy*.yml`）のいずれにも
 * 一切登場しないものを「配線漏れの疑い」として返す。
 * @param referencedFieldNames extractReferencedFieldNames の結果
 * @param deployConfigFileContents ファイルパス→内容のマップ
 *   （`wrangler.toml`・デプロイワークフロー想定）
 */
function findUnwiredFields(
    referencedFieldNames: string[],
    deployConfigFileContents: Record<string, string>,
): WiringGap[] {
    const allConfig = Object.values(deployConfigFileContents).join('\n');
    return referencedFieldNames
        .filter((name) => !new RegExp(`\\b${name}\\b`).test(allConfig))
        .map((field) => ({ field }));
}

/**
 * glob パターンにマッチする全ファイルの内容を読み込む。
 * @param pattern Bun.Glob に渡すパターン
 * @param cwd 検索対象のルートディレクトリ
 */
async function readMatchingFiles(
    pattern: string,
    cwd: string,
): Promise<Record<string, string>> {
    const glob = new Bun.Glob(pattern);
    const contents: Record<string, string> = {};
    for await (const relPath of glob.scan({ cwd, dot: true })) {
        contents[relPath] = readFileSync(`${cwd}/${relPath}`, 'utf8');
    }
    return contents;
}

async function main(): Promise<void> {
    const repoRoot = process.cwd();
    const cloudFlareEnvSource = readFileSync(CLOUDFLARE_ENV_PATH, 'utf8');
    const fieldNames = extractStringFieldNames(cloudFlareEnvSource);

    const sourceFiles = await readMatchingFiles(
        'packages/*/src/**/*.ts',
        repoRoot,
    );
    const referencedFields = extractReferencedFieldNames(
        fieldNames,
        sourceFiles,
    );

    const deployConfigFiles = {
        ...(await readMatchingFiles('packages/*/wrangler.toml', repoRoot)),
        ...(await readMatchingFiles('.github/workflows/*.yml', repoRoot)),
    };
    const gaps = findUnwiredFields(referencedFields, deployConfigFiles);

    if (gaps.length === 0) {
        console.log(
            `✅ ${referencedFields.length}件の環境変数フィールドはすべてデプロイ設定に登場しています`,
        );
        return;
    }

    console.error(
        `❌ 以下の環境変数フィールドがコードから読まれていますが、wrangler.toml・デプロイワークフローのどこにも登場しません（配線漏れの疑い）:`,
    );
    for (const gap of gaps) {
        console.error(`   - ${gap.field}`);
    }
    console.error(
        '   packages/core/src/utilities/platform/cloudFlareEnv.ts にフィールドを追加した場合、' +
            '.github/workflows/deploy-*-reusable.yml の secrets-json（またはwrangler.tomlのvars）へも' +
            '配線してください（PUSH_DISPATCH_TOKEN/ADMIN_TOKENと同じパターン）。',
    );
    process.exit(1);
}

if (import.meta.main) {
    void main();
}

export type { WiringGap };
export {
    extractReferencedFieldNames,
    extractStringFieldNames,
    findUnwiredFields,
};
