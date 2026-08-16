/**
 * schema.test.ts - src/db/schema.ts と packages/db/migrations/*.sql のドリフト検知テスト
 *
 * @remarks
 * schema.ts はマイグレーションSQL（正）に手動で追従させる Drizzle スキーマ定義であり、
 * drizzle-kit による自動生成ではない（.claude/docs/coding-conventions.md 参照）。
 * そのため「マイグレーションにカラムを追加したが schema.ts の追従を忘れた」
 * 「schema.ts のカラム名をtypoした」といった不整合が実行時まで検知されないリスクがある。
 * 本テストは createInMemoryD1Database() が適用した実際のテーブル構造（PRAGMA table_info）と
 * schema.ts のカラム定義を突き合わせ、ドリフトを機械的に検知する。
 *
 * ## デシジョンテーブル
 *
 * | ケース | 検証対象 | 期待値 |
 * |--------|----------|--------|
 * | T1 | schema.ts の各テーブルが実DBに存在するか | 全テーブルが存在する |
 * | T2 | 各テーブルのカラム名集合（schema.ts vs 実DB） | 完全一致（過不足なし） |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { getTableColumns, getTableName } from 'drizzle-orm';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';

/** PRAGMA table_info(<table>) の1行 */
interface TableInfoRow {
    name: string;
}

/** 実DBからテーブルのカラム名一覧を取得する */
const fetchActualColumnNames = async (
    db: D1Database,
    tableName: string,
): Promise<string[]> => {
    const { results } = await db
        .prepare(`PRAGMA table_info(${tableName})`)
        .all<TableInfoRow>();
    return results.map((row) => row.name);
};

const schemaTables = Object.values(schema);

describe('src/db/schema.ts と packages/db/migrations の整合性', () => {
    it.each(schemaTables.map((table) => [table] as const))(
        'T1/T2: %s のカラム定義が実DBのテーブル構造と一致すること',
        async (table) => {
            const db = createInMemoryD1Database();
            const tableName = getTableName(table);

            const actualColumnNames = await fetchActualColumnNames(
                db,
                tableName,
            );
            // T1: マイグレーション未適用（typo等）ならカラムが1件も取れない
            expect(actualColumnNames.length).toBeGreaterThan(0);

            // T2: schema.ts側のカラム名（DBカラム名）集合と実DBのカラム名集合を突き合わせる
            const expectedColumnNames = Object.values(
                getTableColumns(table),
            ).map((column) => column.name);
            expect(new Set(actualColumnNames)).toEqual(
                new Set(expectedColumnNames),
            );
        },
    );
});
