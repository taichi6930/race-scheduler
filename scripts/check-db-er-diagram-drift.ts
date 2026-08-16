#!/usr/bin/env bun
/**
 * check-db-er-diagram-drift.ts
 *
 * `packages/db/migrations/*.sql`（正）と `packages/db/README.md` のER図
 * （Mermaid `erDiagram`）に列挙されているテーブル一覧のドリフトを検証する。
 *
 * `packages/api/scripts/checkSchemaDrift.ts`（DEP-026、`schema.ts`向け）と同じ
 * 「全マイグレーションをin-memory SQLiteに適用して実テーブル一覧を取得する」方式を
 * 使うが、比較対象はREADME.md内のER図（テーブル名の集合のみ。カラム・型・
 * リレーションまでは検証しない。checkSchemaDrift.tsと同様、誤検知を避けるため
 * 検証範囲をテーブルの過不足のみに絞っている）。
 *
 * 使い方（リポジトリルートから）:
 *   bun scripts/check-db-er-diagram-drift.ts
 */

import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'packages/db/migrations');
const README_PATH = join(import.meta.dir, '..', 'packages/db/README.md');

/** マイグレーションを実際にin-memory DBへ適用し、実テーブル名一覧を取得する */
export function loadActualTableNames(migrationsDir: string): Set<string> {
    const db = new Database(':memory:');
    const files = readdirSync(migrationsDir)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');
        db.exec(sql);
    }

    const tables = db
        .query<{ name: string }, []>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'd1_migrations'",
        )
        .all();
    return new Set(tables.map((t) => t.name));
}

/**
 * README.md内のMermaid `erDiagram`ブロックから、属性ブロック（`tableName { ... }`）を
 * 持つエンティティ名を抽出する。リレーション行（`a ||--o{ b : "..."`）のみに登場する
 * 名前は実テーブルとの1:1対応が無いため対象外とする。
 * @param readmeContent - `packages/db/README.md` の内容
 * @returns ER図に記載されているテーブル名の集合（ブロックが見つからない場合は空集合）
 */
export function extractErDiagramTableNames(readmeContent: string): Set<string> {
    const mermaidMatch = /```mermaid\s+erDiagram([\s\S]*?)```/.exec(
        readmeContent,
    );
    if (!mermaidMatch) {
        return new Set();
    }

    const entityBlockRe = /^\s*(\w+)\s*\{/gm;
    const names = new Set<string>();
    for (const match of mermaidMatch[1].matchAll(entityBlockRe)) {
        names.add(match[1]);
    }
    return names;
}

export interface ErDiagramDriftIssue {
    kind: 'missing-in-diagram' | 'stale-in-diagram';
    tableName: string;
}

/**
 * 実テーブル名一覧とER図記載のテーブル名一覧を突き合わせ、過不足を検出する
 * @param actual - マイグレーション適用後の実テーブル名一覧
 * @param documented - ER図に記載されているテーブル名一覧
 * @returns 検出した不整合（無ければ空配列）
 */
export function diffTableNames(
    actual: Set<string>,
    documented: Set<string>,
): ErDiagramDriftIssue[] {
    const issues: ErDiagramDriftIssue[] = [];

    for (const tableName of actual) {
        if (!documented.has(tableName)) {
            issues.push({ kind: 'missing-in-diagram', tableName });
        }
    }
    for (const tableName of documented) {
        if (!actual.has(tableName)) {
            issues.push({ kind: 'stale-in-diagram', tableName });
        }
    }

    return issues;
}

if (import.meta.main) {
    const actual = loadActualTableNames(MIGRATIONS_DIR);
    const documented = extractErDiagramTableNames(
        readFileSync(README_PATH, 'utf-8'),
    );
    const issues = diffTableNames(actual, documented);

    if (issues.length === 0) {
        // eslint-disable-next-line no-console
        console.log(
            `✅ ${actual.size}テーブルすべてで、マイグレーションと packages/db/README.md のER図が一致しています`,
        );
        process.exit(0);
    }

    for (const issue of issues) {
        const message =
            issue.kind === 'missing-in-diagram'
                ? `❌ テーブル "${issue.tableName}" はマイグレーションには存在しますが、packages/db/README.md のER図に記載がありません`
                : `❌ テーブル "${issue.tableName}" は packages/db/README.md のER図に記載されていますが、マイグレーションには存在しません`;
        // eslint-disable-next-line no-console
        console.error(message);
    }
    console.error(
        '\nmigrations（正）と packages/db/README.md のER図の間にドリフトがあります。ER図を実際のテーブル構成に合わせて更新してください。',
    );
    process.exit(1);
}
