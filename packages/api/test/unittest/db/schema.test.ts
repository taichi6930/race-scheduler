/**
 * schema.test.ts - src/db/schema.ts と packages/db/migrations/*.sql のドリフト検知テスト
 *
 * @remarks
 * schema.ts はマイグレーションSQL（正）に手動で追従させる Drizzle スキーマ定義であり、
 * drizzle-kit による自動生成ではない（.claude/docs/coding-conventions.md 参照）。
 * そのため「マイグレーションにカラムを追加したが schema.ts の追従を忘れた」
 * 「schema.ts のカラム名をtypoした」といった不整合が実行時まで検知されないリスクがある。
 * 本テストは createInMemoryD1Database() が適用した実際のテーブル構造（PRAGMA table_info /
 * index_list / index_info）と schema.ts の定義を突き合わせ、ドリフトを機械的に検知する。
 *
 * T3/T4はミューテーションテスト（Stryker）で発見した検証漏れの追加。T1/T2（カラム名の
 * 存在確認）だけでは `.notNull()`/`.default()`/`.primaryKey()`/`uniqueIndex()` が
 * 消えても検知できなかった。
 *
 * @remarks 単一カラムPRIMARY KEY（`.primaryKey()`）のnotnull判定について
 * SQLiteは単一カラムPKに `NOT NULL` を明示していないマイグレーションSQLでは
 * `PRAGMA table_info` の `notnull` が0を返す（PRIMARY KEY自体がNULL不可を暗黙的に
 * 保証するため、SQLite的にはNOT NULLキーワードの重複記述が不要という扱い）。
 * drizzle側は `.primaryKey()` のみのカラムでも意味的に `notNull: true` を返すため、
 * 単純比較すると全ての単一PKカラムで偽の不一致になる。そのため T3 のnotnull比較は
 * 単一カラムPK（`col.primary === true`）を対象外とする（複合PKの各カラムは
 * `.notNull()` が別途明示されており実際に notnull:1 を返すため対象に含める）。
 *
 * ## デシジョンテーブル
 *
 * | ケース | 検証対象 | 期待値 |
 * |--------|----------|--------|
 * | T1 | schema.ts の各テーブルが実DBに存在するか | 全テーブルが存在する |
 * | T2 | 各テーブルのカラム名集合（schema.ts vs 実DB） | 完全一致（過不足なし） |
 * | T3 | 各カラムのPK/NOT NULL/デフォルト値有無（schema.ts vs 実DB） | 完全一致 |
 * | T4 | uniqueIndex()/primaryKey({columns})で明示された制約（schema.ts vs 実DB） | 完全一致 |
 *
 * ## カバレッジ目標: 行・分岐カバレッジ 100%
 */

import { describe, expect, it } from 'bun:test';
import type { D1Database } from '@cloudflare/workers-types';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import * as schema from '../../../src/db/schema';
import { createInMemoryD1Database } from '../../common/inMemoryD1';

/** PRAGMA table_info(<table>) の1行 */
interface TableInfoRow {
    name: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
}

/** PRAGMA index_list(<table>) の1行 */
interface IndexListRow {
    name: string;
    unique: number;
}

/** PRAGMA index_info(<index>) の1行 */
interface IndexInfoRow {
    seqno: number;
    name: string;
}

/** 実DBからテーブルのカラム定義一覧（PRAGMA table_info）を取得する */
const fetchTableInfo = async (
    db: D1Database,
    tableName: string,
): Promise<TableInfoRow[]> => {
    const { results } = await db
        .prepare(`PRAGMA table_info(${tableName})`)
        .all<TableInfoRow>();
    return results;
};

/** 実DBからテーブルのインデックス一覧（PRAGMA index_list）を取得する */
const fetchIndexList = async (
    db: D1Database,
    tableName: string,
): Promise<IndexListRow[]> => {
    const { results } = await db
        .prepare(`PRAGMA index_list(${tableName})`)
        .all<IndexListRow>();
    return results;
};

/** 実DBからインデックスの構成カラム一覧（PRAGMA index_info、seqno順）を取得する */
const fetchIndexColumnNames = async (
    db: D1Database,
    indexName: string,
): Promise<string[]> => {
    const { results } = await db
        .prepare(`PRAGMA index_info(${indexName})`)
        .all<IndexInfoRow>();
    return results
        .slice()
        .sort((a, b) => a.seqno - b.seqno)
        .map((row) => row.name);
};

/**
 * インデックス構成カラムからカラム名を取り出す。
 * drizzleの`IndexColumn`は生SQL式（`SQL<unknown>`）も許容する型だが、本スキーマの
 * 明示インデックスは全て通常のカラム参照のみで構成されている。生SQL式が来た場合は
 * このテスト自体が想定外のスキーマ変更を検知したことになるため、握り潰さずthrowする。
 * @param column - getTableConfig().indexes[].config.columns の1要素
 */
const getIndexColumnName = (column: unknown): string => {
    if (
        typeof column !== 'object' ||
        column === null ||
        !('name' in column) ||
        typeof column.name !== 'string'
    ) {
        throw new Error(
            'インデックスのカラムが生SQL式で構成されています（テスト未対応）',
        );
    }
    return column.name;
};

const schemaTables = Object.values(schema);

describe('src/db/schema.ts と packages/db/migrations の整合性', () => {
    it.each(schemaTables.map((table) => [table] as const))(
        'T1/T2/T3: %s のカラム定義（存在・PK・NOT NULL・デフォルト値有無）が実DBと一致すること',
        async (table) => {
            const db = createInMemoryD1Database();
            const tableName = getTableName(table);

            const actualColumns = await fetchTableInfo(db, tableName);
            // T1: マイグレーション未適用（typo等）ならカラムが1件も取れない
            expect(actualColumns.length).toBeGreaterThan(0);

            const columns = getTableColumns(table);
            const expectedColumnNames = Object.values(columns).map(
                (column) => column.name,
            );
            // T2: schema.ts側のカラム名（DBカラム名）集合と実DBのカラム名集合を突き合わせる
            expect(new Set(actualColumns.map((row) => row.name))).toEqual(
                new Set(expectedColumnNames),
            );

            const { primaryKeys } = getTableConfig(table);
            const compositePkColumnNames = new Set(
                primaryKeys[0]?.columns.map((column) => column.name) ?? [],
            );

            const actualByName = new Map(
                actualColumns.map((row) => [row.name, row]),
            );
            for (const column of Object.values(columns)) {
                const actual = actualByName.get(column.name);
                if (!actual) continue; // T2で既に不一致検知済み

                const isCompositePk = compositePkColumnNames.has(column.name);
                // T3-a: PK判定（単一カラムPKはcol.primary、複合PKはprimaryKeys経由）
                const expectedIsPk = column.primary || isCompositePk;
                expect(actual.pk > 0).toBe(expectedIsPk);

                // T3-b/c: NOT NULL・デフォルト値判定。単一カラムPK
                // （`integer('id').primaryKey({ autoIncrement: true })` 等）は対象外
                // （上記remarks参照）。AUTOINCREMENT/CHECK制約はSQLite上「値の自動採番」
                // であって literal な DEFAULT/NOT NULL 句ではないため、drizzle側の
                // 意味的な notNull:true/hasDefault:true と PRAGMA報告が一致しない。
                // 複合PKの各カラムは対象に含める（実際に明示notNull()されている）。
                if (!column.primary) {
                    expect(actual.notnull === 1).toBe(column.notNull);
                    // T3-c: デフォルト値の有無（値そのものの内容比較はしない。SQL式/
                    // リテラルが混在し比較が複雑になるため、有無だけを見る）
                    expect(actual.dflt_value !== null).toBe(column.hasDefault);
                }
            }
        },
    );

    it.each(
        schemaTables
            .map((table) => ({
                table,
                indexes: getTableConfig(table).indexes,
            }))
            .filter(({ indexes }) => indexes.length > 0)
            .flatMap(({ table, indexes }) =>
                indexes.map((index) => [table, index] as const),
            ),
    )(
        'T4: %s の明示的インデックス定義が実DBと一致すること',
        async (table, index) => {
            const db = createInMemoryD1Database();
            const tableName = getTableName(table);

            const indexList = await fetchIndexList(db, tableName);
            const actualIndex = indexList.find(
                (row) => row.name === index.config.name,
            );

            // T4-a: インデックス自体が実DBに存在する
            expect(actualIndex).toBeDefined();
            // T4-b: unique/非uniqueの区別が一致する
            expect(actualIndex?.unique === 1).toBe(
                index.config.unique ?? false,
            );

            // T4-c: 構成カラム（順序込み）が一致する
            const actualColumnNames = await fetchIndexColumnNames(
                db,
                index.config.name,
            );
            expect(actualColumnNames).toEqual(
                index.config.columns.map(getIndexColumnName),
            );
        },
    );

    it.each(
        schemaTables
            .map((table) => ({
                table,
                primaryKeys: getTableConfig(table).primaryKeys,
            }))
            .filter(({ primaryKeys }) => primaryKeys.length > 0)
            .map(({ table, primaryKeys }) => [table, primaryKeys[0]] as const),
    )(
        'T4: %s の複合PRIMARY KEY構成カラムが実DBと一致すること',
        async (table, primaryKey) => {
            const db = createInMemoryD1Database();
            const tableName = getTableName(table);

            const actualColumns = await fetchTableInfo(db, tableName);
            const actualPkColumnNames = new Set(
                actualColumns
                    .filter((row) => row.pk > 0)
                    .map((row) => row.name),
            );

            expect(actualPkColumnNames).toEqual(
                new Set(primaryKey.columns.map((column) => column.name)),
            );
        },
    );
});
