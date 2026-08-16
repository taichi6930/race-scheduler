import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type * as schema from '../../db/schema';

/**
 * Drizzle ORM のクエリビルダインスタンスを供給する Gateway のインターフェース
 * @remarks
 * D1（本番）・bun:sqlite（テスト）のいずれの実装も、drizzle-orm/d1 の
 * `drizzle()` でラップした DrizzleD1Database を返す（テスト側は D1Database
 * 互換アダプタで bun:sqlite をラップすることで型を揃える。詳細は
 * inMemoryDrizzleGateway.ts を参照）。
 */
export interface IDrizzleGateway {
    readonly db: DrizzleD1Database<typeof schema>;
}
