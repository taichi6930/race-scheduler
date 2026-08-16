import { isEnvFlagTrue } from '@race-schedule/core';

/**
 * インメモリDBを使用するかどうかの判定を一元化する。
 *
 * 判定条件が router（`c.env` 経由）と di（`process.env` のみ）で二重化・微妙に相違していたため集約する。
 * Cloudflare Workers の `env`（`c.env`）に `USE_IN_MEMORY_DB='true'` があればそれを、
 * なければ `process.env.USE_IN_MEMORY_DB` を見る。
 * @param env - Hono コンテキストの env 相当（省略時は `process.env` のみで判定）
 * @returns インメモリDBを使う場合 true
 */
export const isUseInMemoryDB = (env?: unknown): boolean =>
    isEnvFlagTrue('USE_IN_MEMORY_DB', env);
