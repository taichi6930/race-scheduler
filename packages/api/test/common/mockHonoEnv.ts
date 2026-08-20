import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

/**
 * テストで使うサービス間認証トークンのモック値。
 * `buildMockHonoEnv` が `c.env.SERVICE_AUTH_TOKEN` に設定する値と同じにすることで、
 * 保護対象ルートを呼ぶテストは `{ [SERVICE_AUTH_HEADER]: MOCK_SERVICE_AUTH_TOKEN }` を
 * リクエストヘッダーに付与するだけで通過できる。
 */
export const MOCK_SERVICE_AUTH_TOKEN = 'mock-service-auth-token';

/**
 * テストで使う `/push/dispatch` 用のモック値。
 * `EnvStore` はプロセス全体で共有されるモジュールスコープの単一状態のため、
 * 複数のコンポーネントテストファイルが同時に実行されると、あるリクエストの
 * `ensureDIInitialized` が別のリクエスト処理中に env を上書きしうる
 * （bunfig.toml の `singleThreaded=false` によるファイル間並行実行）。
 * `buildMockHonoEnv` の既定値に含めることで、どのリクエストの env が
 * 最終的に読まれても同じ値になり、この競合の影響を受けなくなる。
 */
export const MOCK_PUSH_DISPATCH_TOKEN = 'mock-push-dispatch-token';

/**
 * Hono コンテキストに渡すモック環境変数を組み立てる。
 * `ensureDIInitialized` が `API_REQUIRED_KEYS` のバリデーションを通過するために必要な
 * フィールドを全て埋める。DB は呼び出し側が用意した InMemory D1（または任意のフェイク）を渡す。
 * router.test.ts とコンポーネントテストで共有する。
 * @param db - EnvStore.env.DB へ設定する D1Database
 */
export const buildMockHonoEnv = (db: D1Database) => ({
    JRA_CALENDAR_ID: 'mock-jra-calendar-id',
    NAR_CALENDAR_ID: 'mock-nar-calendar-id',
    WORLD_CALENDAR_ID: 'mock-world-calendar-id',
    KEIRIN_CALENDAR_ID: 'mock-keirin-calendar-id',
    AUTORACE_CALENDAR_ID: 'mock-autorace-calendar-id',
    BOATRACE_CALENDAR_ID: 'mock-boatrace-calendar-id',
    GOOGLE_CLIENT_EMAIL: 'mock@example.com',
    GOOGLE_PRIVATE_KEY:
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAtestKeyForUnitTest\n-----END RSA PRIVATE KEY-----',
    USE_IN_MEMORY_DB: 'true',
    DB: db,
    R2_BUCKET: {} as unknown as R2Bucket,
    CORS_ALLOWED_ORIGINS: '*',
    SERVICE_AUTH_TOKEN: MOCK_SERVICE_AUTH_TOKEN,
    PUSH_DISPATCH_TOKEN: MOCK_PUSH_DISPATCH_TOKEN,
    WEBAUTHN_RP_ID: 'front.example.com',
});
