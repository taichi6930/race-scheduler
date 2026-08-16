import { Database as BunSqliteDatabase, type Statement } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
    D1Database,
    D1ExecResult,
    D1PreparedStatement,
    D1Result,
} from '@cloudflare/workers-types';

/**
 * packages/db/migrations/*.sql を bun:sqlite のインメモリDBへ適用するためのテスト専用ハーネス。
 * @remarks
 * マイグレーションの正は packages/db/migrations/*.sql（wrangler d1 migrations）のまま。
 * ここではそれを「テストのたびに実 SQLite へそのまま流し込む」ことで、
 * 生成される DrizzleD1Database が本番（D1）とテストで同一コードパスを通ることを保証する
 * （drizzle-orm/d1 は D1Database.prepare().bind().all()/run() のみを呼び出すため、
 * bun:sqlite をその形に薄くラップするだけで良い）。
 */

const MIGRATIONS_DIR = join(import.meta.dir, '../../../db/migrations');

let cachedMigrationSql: string[] | undefined;

/** packages/db/migrations 配下の *.sql をファイル名昇順で読み込む（1回だけ・以降キャッシュ） */
const loadMigrationSql = (): string[] => {
    cachedMigrationSql ??= readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'));
    return cachedMigrationSql;
};

/** D1PreparedStatement.all()/run() が返す D1Result の meta を（テストでは未使用のため）ダミーで満たす */
const buildD1Meta = (): D1Result['meta'] => ({
    duration: 0,
    served_by: 'bun-sqlite-test',
    internal_stats: '',
    size_after: 0,
    rows_read: 0,
    rows_written: 0,
    last_row_id: 0,
    changes: 0,
    served_by_description: 'bun-sqlite-test',
    changed_db: false,
});

/** bun:sqlite の Statement を D1PreparedStatement 互換のオブジェクトへラップする */
const wrapStatement = (
    sqlite: BunSqliteDatabase,
    sql: string,
): D1PreparedStatement => {
    let boundParams: unknown[] = [];

    const statementFor = (): Statement =>
        sqlite.query(sql) as unknown as Statement;

    const adapter: Partial<D1PreparedStatement> = {
        bind: (...values: unknown[]) => {
            boundParams = values;
            return adapter as D1PreparedStatement;
        },
        all: <T = Record<string, unknown>>() =>
            Promise.resolve<D1Result<T>>({
                success: true,
                results: statementFor().all(...(boundParams as never[])) as T[],
                meta: buildD1Meta(),
            }),
        first: <T>(colName?: string) => {
            const row = statementFor().get(
                ...(boundParams as never[]),
            ) as Record<string, unknown> | null;
            if (row === null) {
                return Promise.resolve(null);
            }
            return Promise.resolve(
                (colName === undefined ? row : row[colName]) as T,
            );
        },
        run: <T = Record<string, unknown>>() => {
            statementFor().run(...(boundParams as never[]));
            return Promise.resolve<D1Result<T>>({
                success: true,
                results: [],
                meta: buildD1Meta(),
            });
        },
        raw: ((options?: { columnNames?: boolean }) => {
            const stmt = statementFor();
            const rows = stmt.values(...(boundParams as never[]));
            if (options?.columnNames === true) {
                return Promise.resolve([stmt.columnNames, ...rows]);
            }
            return Promise.resolve(rows);
        }) as D1PreparedStatement['raw'],
    };

    return adapter as D1PreparedStatement;
};

/**
 * bun:sqlite のインメモリDBを作成し、packages/db/migrations/*.sql を適用したうえで
 * D1Database 互換のアダプタとして返す。
 * @remarks
 * drizzle-orm/d1 が実際に呼び出すのは prepare().bind().all()/run()、および
 * db.batch() 使用時の batch()（CONC-08対応）のみ（exec/withSession/dump は
 * 通常経路では呼ばれない）。setupGlobalMocks.ts の `mockDB as D1Database` と
 * 同様の型アサーション方針に倣い、Partial<D1Database> を実装したうえで
 * 最終的に D1Database としてキャストする。
 */
export const createInMemoryD1Database = (): D1Database => {
    const sqlite = new BunSqliteDatabase(':memory:');
    for (const sql of loadMigrationSql()) {
        sqlite.exec(sql);
    }

    const adapter: Partial<D1Database> = {
        prepare: (sql: string) => wrapStatement(sqlite, sql),
        exec: (sql: string): Promise<D1ExecResult> => {
            sqlite.exec(sql);
            return Promise.resolve({ count: 1, duration: 0 });
        },
        // CONC-08: db.batch() が呼ぶ。drizzle-orm/d1 の SQLiteD1Session.batch()
        // は各文の実行結果（D1Result、.results フィールドを含む）を順序どおりの
        // 配列として期待する（mapResult が result.results を参照するため）ので、
        // 各文を wrapStatement の all() で順に実行して集約する。
        batch: async <T = Record<string, unknown>>(
            statements: D1PreparedStatement[],
        ): Promise<D1Result<T>[]> => {
            const results: D1Result<T>[] = [];
            for (const statement of statements) {
                results.push(await statement.all<T>());
            }
            return results;
        },
    };

    return adapter as D1Database;
};
