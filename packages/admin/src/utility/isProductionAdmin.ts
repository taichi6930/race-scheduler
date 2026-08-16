/**
 * admin Workerがproduction環境で動いているかを判定する。
 *
 * `@race-schedule/core`の`isProductionEnvironment()`（`process.env.NODE_ENV`）は
 * 使わない。Cloudflare Workersのビルド/デプロイ経路（wrangler）は、
 * `wrangler.toml`の`[env.X.vars]`でNODE_ENVを明示的に設定していない環境でも
 * `wrangler deploy`時にNODE_ENVを`'production'`として扱うことがあり
 * （`wrangler dev`時は`'development'`）、test環境にデプロイしたWorkerでも
 * `isProductionEnvironment()`が`true`を返してしまう不具合が実機で確認された
 * （2026-08-08、機能フラグ管理画面のtest環境で「本番環境」バッジ・読み取り専用化が
 * 誤って表示される形で顕在化）。
 *
 * この関数は`NODE_ENV`という予約語的な扱いを受けやすい名前を避け、
 * `wrangler.toml`で明示的に設定する専用の環境変数`ADMIN_ENVIRONMENT`
 * （production環境では`'production'`、test環境では`'test'`）のみを見て判定する。
 * @returns production環境なら true
 */
export const isProductionAdmin = (): boolean =>
    process.env.ADMIN_ENVIRONMENT === 'production';
