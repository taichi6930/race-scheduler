/**
 * 環境変数のブールフラグ判定を一元化する汎用ヘルパー。
 *
 * Cloudflare Workers の `env`（`c.env`）に該当キーの値 `'true'` があればそれを、
 * なければ `process.env[key]` を見る、という共通パターンを提供する。
 * @param key - 判定対象の環境変数キー
 * @param env - Hono コンテキストの env 相当（省略時は `process.env` のみで判定）
 * @returns 値が `'true'` の場合 true
 */
export const isEnvFlagTrue = (key: string, env?: unknown): boolean => {
    const isFromEnv =
        typeof env === 'object' &&
        env !== null &&
        (env as Record<string, unknown>)[key] === 'true';
    return isFromEnv || process.env[key] === 'true';
};
