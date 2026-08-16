#!/usr/bin/env bun
/**
 * check-audit-allowlist.ts
 *
 * `docs/security/audit-allowlist.json`（DEP-020）を検証し、`bun audit` に渡す
 * `--ignore=<GHSA-ID>` フラグ列を組み立てる。allowlistは「対応不要と判断した脆弱性」を
 * 個別に追跡するための機構であり、恒久的な放置を防ぐため各エントリに再レビュー期限
 * （reviewBy）を必須とする。
 *
 * 使い方:
 *   bun scripts/check-audit-allowlist.ts               # 人間向け表示（内容・期限切れ警告）
 *   bun scripts/check-audit-allowlist.ts --ignore-flags # CI用: --ignoreフラグ列のみ出力
 *   bun scripts/check-audit-allowlist.ts --json         # JSON出力
 *
 * 終了コード: スキーマ違反（必須フィールド欠落・日付形式不正等）があれば1、無ければ0。
 * 期限切れ（reviewBy超過）はブロッキングではなく警告のみ（`bun audit`自体が
 * scheduled-tests.ymlでcontinue-on-errorのため、allowlist検証だけを理由に
 * 無関係なジョブを落とすのは過剰と判断）。
 */

/* eslint-disable no-console */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface AllowlistEntry {
    id: string;
    package: string;
    reason: string;
    addedAt: string;
    reviewBy: string;
}

const ROOT = process.cwd();
const ALLOWLIST_PATH = join(ROOT, 'docs/security/audit-allowlist.json');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GHSA_ID_PATTERN = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;

const REQUIRED_STRING_FIELDS = [
    'id',
    'package',
    'reason',
    'addedAt',
    'reviewBy',
] as const;

/**
 * 1エントリのスキーマを検証する。
 * @param entry 検証対象（`unknown`。JSON.parseの結果をそのまま渡す想定）
 * @param index allowlist配列内のインデックス（エラーメッセージ用）
 * @returns 検証エラーメッセージの配列（問題無ければ空配列）
 */
function validateEntry(entry: unknown, index: number): string[] {
    const errors: string[] = [];
    const prefix = `allowlist[${index}]`;

    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        return [`${prefix}: オブジェクトである必要があります`];
    }

    const record = entry as Record<string, unknown>;

    for (const field of REQUIRED_STRING_FIELDS) {
        if (typeof record[field] !== 'string' || record[field] === '') {
            errors.push(`${prefix}.${field}: 必須の文字列フィールドです`);
        }
    }

    if (typeof record.id === 'string' && !GHSA_ID_PATTERN.test(record.id)) {
        errors.push(
            `${prefix}.id: "${record.id}" はGHSA形式（GHSA-xxxx-xxxx-xxxx）ではありません`,
        );
    }

    for (const field of ['addedAt', 'reviewBy'] as const) {
        const value = record[field];
        if (typeof value === 'string' && !DATE_PATTERN.test(value)) {
            errors.push(
                `${prefix}.${field}: "${value}" はYYYY-MM-DD形式ではありません`,
            );
        }
    }

    return errors;
}

/**
 * allowlistファイルを読み込み、スキーマ検証済みのエントリ一覧を返す。
 * @param path allowlistファイルのパス（既定: `docs/security/audit-allowlist.json`）
 * @returns 検証結果（entries: 検証済みエントリ、errors: スキーマ違反メッセージ）
 */
function loadAllowlist(path: string = ALLOWLIST_PATH): {
    entries: AllowlistEntry[];
    errors: string[];
} {
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        // ファイル自体が無い場合は「allowlistなし」として扱う（新規リポジトリ等）。
        return { entries: [], errors: [] };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return {
            entries: [],
            errors: [`JSON構文エラー: ${(error as Error).message}`],
        };
    }

    if (!Array.isArray(parsed)) {
        return { entries: [], errors: ['allowlistは配列である必要があります'] };
    }

    const errors: string[] = [];
    parsed.forEach((entry, index) => {
        errors.push(...validateEntry(entry, index));
    });

    if (errors.length > 0) {
        return { entries: [], errors };
    }

    return { entries: parsed as AllowlistEntry[], errors: [] };
}

/**
 * reviewBy期限が今日より前（期限切れ）のエントリを返す。
 * @param entries 検証済みエントリ一覧
 * @param today 判定基準日（テスト容易性のため注入可能にする）
 */
function findExpiredEntries(
    entries: AllowlistEntry[],
    today: Date,
): AllowlistEntry[] {
    return entries.filter((entry) => new Date(entry.reviewBy) < today);
}

/**
 * `bun audit`へ渡す`--ignore=<id>`フラグ列を組み立てる。
 * @param entries 検証済みエントリ一覧
 */
function buildIgnoreFlags(entries: AllowlistEntry[]): string {
    return entries.map((entry) => `--ignore=${entry.id}`).join(' ');
}

function main(): void {
    const args = process.argv.slice(2);
    const isJson = args.includes('--json');
    const isIgnoreFlags = args.includes('--ignore-flags');

    const { entries, errors } = loadAllowlist();

    if (errors.length > 0) {
        console.error('❌ audit-allowlist.json のスキーマ検証に失敗しました:');
        for (const error of errors) {
            console.error(`   - ${error}`);
        }
        process.exit(1);
    }

    if (isIgnoreFlags) {
        process.stdout.write(`${buildIgnoreFlags(entries)}\n`);
        return;
    }

    const expired = findExpiredEntries(entries, new Date());

    if (isJson) {
        process.stdout.write(
            `${JSON.stringify({ entries, expired }, null, 2)}\n`,
        );
        return;
    }

    console.log(`\n🔍 bun audit allowlist（${entries.length}件）`);
    for (const entry of entries) {
        console.log(`   - ${entry.id}（${entry.package}）: ${entry.reason}`);
        console.log(
            `     追加: ${entry.addedAt} / 再レビュー期限: ${entry.reviewBy}`,
        );
    }
    if (entries.length === 0) {
        console.log('   （allowlistは空です）');
    }
    if (expired.length > 0) {
        console.log(
            `\n⚠️  再レビュー期限切れのエントリが${expired.length}件あります:`,
        );
        for (const entry of expired) {
            console.log(`   - ${entry.id}（期限: ${entry.reviewBy}）`);
        }
    }
    console.log('');
}

if (import.meta.main) {
    main();
}

export type { AllowlistEntry };
export { buildIgnoreFlags, findExpiredEntries, loadAllowlist, validateEntry };
