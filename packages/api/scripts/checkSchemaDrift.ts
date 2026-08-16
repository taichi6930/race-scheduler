#!/usr/bin/env bun
/**
 * check-schema-drift.ts
 *
 * `packages/db/migrations/*.sql`（マイグレーションSQL、正）と
 * `packages/api/src/db/schema.ts`（Drizzle ORMスキーマ定義、手動追従）の
 * テーブル・カラム構成にドリフトが無いかを検証する（DEP-026対応）。
 *
 * `drizzle-kit`は意図的に不使用（packages/db/README.md参照）なため、代わりに
 * 全マイグレーションを bun:sqlite の in-memory DB に実際に適用し、その結果
 * （sqlite_master / PRAGMA table_info）と schema.ts をdrizzle-ormの導入検査API
 * （getTableColumns等）で読み取った期待値を突き合わせる。
 *
 * このスクリプトが packages/api/scripts/ に置かれているのは、drizzle-orm が
 * このパッケージの依存としてのみインストールされており、ルートの scripts/
 * からは解決できないため（generateVapidKeys.ts と同じ配置方針）。
 *
 * 検証範囲: テーブル名・カラム名の存在一致のみ（型・制約までは検証しない。
 * SQLiteの型アフィニティとDrizzleの宣言型は必ずしも1:1に対応せず、そこまで
 * 厳密に検証すると誤検知が増えるため）。
 *
 * 使い方（packages/api ディレクトリから）:
 *   bun run check:schema-drift
 */

import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';

import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

import * as schema from '../src/db/schema';

const MIGRATIONS_DIR = '../../db/migrations';

/** マイグレーションを実際にin-memory DBへ適用し、実テーブル/カラム構成を取得する */
const loadActualSchema = (): Map<string, Set<string>> => {
    const db = new Database(':memory:');
    const files = readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const sql = readFileSync(`${MIGRATIONS_DIR}/${file}`, 'utf-8');
        try {
            db.exec(sql);
        } catch (error) {
            console.error(`❌ マイグレーション ${file} の適用に失敗しました:`);
            console.error(error);
            process.exit(1);
        }
    }

    const tables = db
        .query<{ name: string }, []>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'd1_migrations'",
        )
        .all();

    const result = new Map<string, Set<string>>();
    for (const { name: tableName } of tables) {
        const columns = db
            .query<{ name: string }, []>(`PRAGMA table_info(${tableName})`)
            .all();
        result.set(tableName, new Set(columns.map((c) => c.name)));
    }
    return result;
};

/** schema.ts から期待されるテーブル/カラム構成を取得する */
const loadExpectedSchema = (): Map<string, Set<string>> => {
    const result = new Map<string, Set<string>>();
    for (const value of Object.values(schema)) {
        if (!is(value, SQLiteTable)) continue;
        const tableName = getTableName(value);
        const columnNames = Object.values(getTableColumns(value)).map(
            (col) => col.name,
        );
        result.set(tableName, new Set(columnNames));
    }
    return result;
};

const actual = loadActualSchema();
const expected = loadExpectedSchema();

let hasDrift = false;

for (const tableName of new Set([...actual.keys(), ...expected.keys()])) {
    const actualColumns = actual.get(tableName);
    const expectedColumns = expected.get(tableName);

    if (!expectedColumns) {
        console.error(
            `❌ テーブル "${tableName}" はマイグレーションには存在しますが、schema.ts に定義がありません`,
        );
        hasDrift = true;
        continue;
    }
    if (!actualColumns) {
        console.error(
            `❌ テーブル "${tableName}" は schema.ts に定義されていますが、マイグレーションには存在しません`,
        );
        hasDrift = true;
        continue;
    }

    const missingInSchema = [...actualColumns].filter(
        (c) => !expectedColumns.has(c),
    );
    const missingInMigrations = [...expectedColumns].filter(
        (c) => !actualColumns.has(c),
    );

    if (missingInSchema.length > 0) {
        console.error(
            `❌ テーブル "${tableName}": マイグレーションにあるが schema.ts に無いカラム: ${missingInSchema.join(', ')}`,
        );
        hasDrift = true;
    }
    if (missingInMigrations.length > 0) {
        console.error(
            `❌ テーブル "${tableName}": schema.ts にあるがマイグレーションに無いカラム: ${missingInMigrations.join(', ')}`,
        );
        hasDrift = true;
    }
}

if (hasDrift) {
    console.error(
        '\nマイグレーションSQL（正）と packages/api/src/db/schema.ts の間にドリフトがあります。schema.ts を手動で追従させてください（DEP-026）。',
    );
    process.exit(1);
}

console.log(
    `✅ ${expected.size}テーブルすべてで、マイグレーションと schema.ts のテーブル/カラム構成が一致しています`,
);
