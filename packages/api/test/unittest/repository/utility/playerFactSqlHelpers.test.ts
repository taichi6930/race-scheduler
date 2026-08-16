/**
 * playerFactSqlHelpers (upsertPlayerFacts) ユニットテスト
 *
 * ## デシジョンテーブル
 *
 * | #    | facts件数 | 期待結果                                             |
 * |------|-----------|--------------------------------------------------------|
 * | T-01 | 0件       | DBへ何も書き込まない                                   |
 * | T-02 | 1件       | player テーブルへ1行（priority=0固定）永続化される     |
 * | T-03 | 同一playerNoを2回渡す | onConflictDoUpdateでplayerNameが後勝ちで更新される |
 * | T-04 | 26件（内部チャンクサイズ25超え） | 全26件が永続化される（内部チャンク分割の境界） |
 * | T-05 | 26件 | 1回のバッチのバインド変数数がD1の上限(100)を超えない（回帰: priority列の数え忘れでfloor(100/3)=33行×4パラメータ=132個を送出し500エラーになっていた） |
 */
import { describe, expect, it } from 'bun:test';

import type {
    D1Database,
    D1PreparedStatement,
} from '@cloudflare/workers-types';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';

import * as schema from '../../../../src/db/schema';
import { upsertPlayerFacts } from '../../../../src/repository/utility/playerFactSqlHelpers';
import { D1_MAX_BIND_VARS } from '../../../../src/repository/utility/upsertChunk';
import { createInMemoryD1Database } from '../../../common/inMemoryD1';

/**
 * D1Database.prepare().bind() に渡されたバインド変数の最大個数を記録するラッパー。
 * @remarks
 * inMemoryD1（bun:sqlite）はSQLite本来の変数上限（デフォルト数千個）で動くため、
 * D1固有の上限(100)超過を実行時エラーとしては再現できない。そのためbind()呼び出しを
 * 直接計測し、実際に送出されるバインド数がD1の上限に収まっているかを検証する。
 * @param rawDb - ラップ対象の D1Database
 * @param maxBoundParams - 観測した最大バインド数を書き込む出力先
 */
const instrumentBindCount = (
    rawDb: D1Database,
    maxBoundParams: { value: number },
): D1Database => {
    const originalPrepare = rawDb.prepare.bind(rawDb);
    rawDb.prepare = (sql: string): D1PreparedStatement => {
        const statement = originalPrepare(sql);
        const originalBind = statement.bind.bind(statement);
        statement.bind = (...values: unknown[]) => {
            maxBoundParams.value = Math.max(
                maxBoundParams.value,
                values.length,
            );
            return originalBind(...values);
        };
        return statement;
    };
    return rawDb;
};

describe('upsertPlayerFacts', () => {
    it('T-01: 空配列を渡すとDBへ何も書き込まない', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );

        await upsertPlayerFacts(db, []);

        const rows = await db.select().from(schema.player);
        expect(rows).toHaveLength(0);
    });

    it('T-02: 1件のファクトがpriority=0固定でplayerテーブルへ永続化される', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );

        await upsertPlayerFacts(db, [
            {
                raceType: 'keirin',
                playerNo: '014833',
                playerName: '高久保雄介',
            },
        ]);

        const rows = await db.select().from(schema.player);
        expect(rows).toHaveLength(1);
        expect(rows[0].playerName).toBe('高久保雄介');
        expect(rows[0].priority).toBe(0);
    });

    it('T-03: 同一player_noを重ねて渡すと後勝ちでplayerNameが更新される', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );

        await upsertPlayerFacts(db, [
            { raceType: 'keirin', playerNo: '014833', playerName: '旧名義' },
        ]);
        await upsertPlayerFacts(db, [
            { raceType: 'keirin', playerNo: '014833', playerName: '新名義' },
        ]);

        const rows = await db.select().from(schema.player);
        expect(rows).toHaveLength(1);
        expect(rows[0].playerName).toBe('新名義');
    });

    it('T-04: 内部チャンクサイズ(25)を超える26件でも全件永続化される', async () => {
        const db: DrizzleD1Database<typeof schema> = drizzle(
            createInMemoryD1Database(),
            { schema },
        );
        const facts = Array.from({ length: 26 }, (_, index) => ({
            raceType: 'keirin',
            playerNo: String(index + 1).padStart(6, '0'),
            playerName: `選手${index + 1}`,
        }));

        await upsertPlayerFacts(db, facts);

        const rows = await db.select().from(schema.player);
        expect(rows).toHaveLength(26);
        expect(new Set(rows.map((r) => r.playerNo))).toEqual(
            new Set(facts.map((f) => f.playerNo)),
        );
    });

    it('T-05: 26件を渡しても1回のバッチのバインド変数数がD1の上限(100)を超えない', async () => {
        const maxBoundParams = { value: 0 };
        const db: DrizzleD1Database<typeof schema> = drizzle(
            instrumentBindCount(createInMemoryD1Database(), maxBoundParams),
            { schema },
        );
        const facts = Array.from({ length: 26 }, (_, index) => ({
            raceType: 'keirin',
            playerNo: String(index + 1).padStart(6, '0'),
            playerName: `選手${index + 1}`,
        }));

        await upsertPlayerFacts(db, facts);

        expect(maxBoundParams.value).toBeLessThanOrEqual(D1_MAX_BIND_VARS);
    });
});
