/**
 * tests/shared/env/setupMiniflareEnv.ts
 *
 * sIT（システム結合テスト）用の共通ヘルパー。miniflare（`wrangler dev --local` と同じ
 * workerd ランタイム）で実 D1・実 R2 を起動し、テスト対象へ本物の D1Database /
 * R2Bucket バインディングを渡せるようにする。
 *
 * コンポーネントテスト が `bun:sqlite` ベースの手作り D1 互換アダプタ
 * （`packages/*\/test/common/inMemoryD1.ts`）を使うのに対し、sIT はここで
 * 実際の D1/R2 エンジン（workerd）を使う点が異なる。より本番に近い経路
 * （D1 の実際のバインディング挙動、R2 の実際のメタデータ挙動等）を検証できる。
 *
 * ## マイグレーション適用について
 *
 * D1 の `Database.exec()` は入力を**改行で分割し、1行=1ステートメント**として実行する
 * （複数行にまたがる CREATE TABLE や `-- ` コメント行を単体で渡すと失敗する）。
 * `packages/db/migrations/*.sql` は複数行の CREATE TABLE・コメント・
 * `BEGIN...END` トリガー本体を含むため、そのまま `exec()` には渡せない。
 * そのため本ヘルパーは:
 *   1. コメント（`-- ` 以降）を行単位で除去する
 *   2. `BEGIN`/`END` の入れ子を追跡し、トリガー本体内の `;` では分割しない
 *      トップレベル分割でステートメントを切り出す
 *   3. 各ステートメントを `db.prepare(sql).run()`（改行分割の制約を受けない
 *      通常の実行経路）で個別に実行する
 * という手順でマイグレーションを適用する。実際に全15マイグレーション・
 * 期待通りのテーブル/トリガー生成を確認済み。
 *
 * 利用例:
 *   import { setupMiniflareEnv } from '../../../../tests/shared/env/setupMiniflareEnv';
 *   import type { MiniflareTestEnv } from '../../../../tests/shared/env/setupMiniflareEnv';
 *
 *   let env: MiniflareTestEnv;
 *   beforeAll(async () => { env = await setupMiniflareEnv(); });
 *   afterAll(async () => { await env.dispose(); });
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const MIGRATIONS_DIR = join(import.meta.dir, '../../../packages/db/migrations');

let cachedMigrationFiles: string[] | undefined;

/** packages/db/migrations 配下の *.sql をファイル名昇順で読み込む（1回だけ・以降キャッシュ） */
const loadMigrationFiles = (): string[] => {
    cachedMigrationFiles ??= readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort();
    return cachedMigrationFiles;
};

/**
 * SQL 文字列から `-- ` 行コメントを行単位で除去する。
 * @remarks 文字列リテラル内に `--` を含むデータは現状のマイグレーションに存在しないため
 * 行頭からの単純な `--` 検出で十分（riskはコメント規約自体が変わったときのみ）。
 * @param sql 対象の SQL 文字列
 */
const stripLineComments = (sql: string): string =>
    sql
        .split('\n')
        .map((line) => {
            const commentStart = line.indexOf('--');
            return commentStart === -1 ? line : line.slice(0, commentStart);
        })
        .join('\n');

/**
 * SQL ファイル全体を、`BEGIN...END`（トリガー本体）の入れ子を尊重した
 * トップレベルの `;` 区切りでステートメント配列に分割する。
 * @param sql 1マイグレーションファイル分の SQL 全文
 */
const splitStatements = (sql: string): string[] => {
    const cleaned = stripLineComments(sql);
    const statements: string[] = [];
    let current = '';
    let beginDepth = 0;

    for (const token of cleaned.split(/(\bBEGIN\b|\bEND\b|;)/i)) {
        if (/^BEGIN$/i.test(token)) {
            beginDepth += 1;
            current += token;
        } else if (/^END$/i.test(token)) {
            beginDepth = Math.max(0, beginDepth - 1);
            current += token;
        } else if (token === ';' && beginDepth === 0) {
            current += ';';
            if (current.trim().length > 0) {
                statements.push(current.trim());
            }
            current = '';
        } else {
            current += token;
        }
    }
    if (current.trim().length > 0) {
        statements.push(current.trim());
    }
    return statements;
};

/**
 * 実 D1（miniflare）へ packages/db/migrations/*.sql を順に適用する
 * @param db 適用対象の D1Database
 */
const applyMigrations = async (db: D1Database): Promise<void> => {
    for (const fileName of loadMigrationFiles()) {
        const sql = readFileSync(join(MIGRATIONS_DIR, fileName), 'utf8');
        for (const statement of splitStatements(sql)) {
            await db.prepare(statement).run();
        }
    }
};

export interface MiniflareTestEnv {
    /** マイグレーション適用済みの実 D1（miniflare/workerd） */
    db: D1Database;
    /** 空の実 R2 バケット（miniflare/workerd） */
    r2: R2Bucket;
    /** miniflare インスタンスを破棄する。afterAll で必ず呼ぶこと */
    dispose: () => Promise<void>;
}

/**
 * miniflare を起動し、マイグレーション適用済みの実 D1 と空の実 R2 バケットを返す。
 * sIT のテストファイルは `beforeAll` でこれを呼び、`afterAll` で `dispose()` すること。
 */
export const setupMiniflareEnv = async (): Promise<MiniflareTestEnv> => {
    // miniflare 5.20260804.0-alpha 以降、Miniflareコンストラクタは新スキーマ
    // （`workers: [{ config: {...} }]`）のみを受け付け、旧来のトップレベル
    // オプション（modules/script/d1Databases/r2Buckets）は直接渡せなくなった。
    // `convertV4MiniflareOptions` が旧形式から新形式への変換を担うため、
    // 呼び出し側の記法自体は変えずに済む。
    const mf = new Miniflare(
        convertV4MiniflareOptions({
            modules: true,
            script: `export default { fetch: () => new Response('sIT test worker') };`,
            d1Databases: { DB: 'sit-test-db' },
            r2Buckets: { R2_BUCKET: 'sit-test-bucket' },
        }),
    );

    const db = await mf.getD1Database('DB');
    const r2 = await mf.getR2Bucket('R2_BUCKET');

    // SAFETY: 下記コメントの通りworkerd実装とアンビエント型の非互換は既知かつ無害。
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions
    await applyMigrations(db as unknown as D1Database);

    return {
        // miniflare の返す D1Database/R2Bucket は workerd の実装型であり、
        // @cloudflare/workers-types のアンビエント型とは構造的に非互換な箇所がある
        // （例: R2Object.writeHttpMetadata が受け取る Headers 型が undici 版と
        // @cloudflare/workers-types 版で異なる）。実行時の挙動は本物の D1/R2 であり、
        // 呼び出し側が使うメソッド（prepare/exec/put/get 等）の実体は満たしているため、
        // unknown 経由でのキャストにとどめる（as any は使わない）。
        // SAFETY: 上記の通りworkerd実装とアンビエント型の非互換は既知かつ無害。
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions
        db: db as unknown as D1Database,
        // SAFETY: 上記の通りworkerd実装とアンビエント型の非互換は既知かつ無害。
        // oxlint-disable-next-line anti-slop/no-chained-type-assertions
        r2: r2 as unknown as R2Bucket,
        dispose: () => mf.dispose(),
    };
};
