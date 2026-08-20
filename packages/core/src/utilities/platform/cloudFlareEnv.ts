import type {
    D1Database,
    R2Bucket,
    RateLimit,
    Workflow,
} from '@cloudflare/workers-types';

/**
 * CloudFlare Workers 環境変数の型定義
 */
export interface CloudFlareEnv {
    DB: D1Database; // D1 データベース
    JRA_CALENDAR_ID: string; // 中央競馬
    NAR_CALENDAR_ID: string; // 地方競馬
    OVERSEAS_CALENDAR_ID?: string; // 海外競馬（RaceType.OVERSEAS に対応）
    /**
     * @deprecated OVERSEAS_CALENDAR_ID を使用してください。
     * 後方互換のため残置。読み取り時は OVERSEAS_CALENDAR_ID ?? WORLD_CALENDAR_ID の順で解決する。
     */
    WORLD_CALENDAR_ID?: string; // 海外競馬（旧キー・後方互換）
    KEIRIN_CALENDAR_ID: string; // 競輪
    AUTORACE_CALENDAR_ID: string; // オートレース
    BOATRACE_CALENDAR_ID: string; // ボートレース
    GOOGLE_CLIENT_EMAIL: string; // Google サービスアカウントのクライアントメール
    GOOGLE_PRIVATE_KEY: string; // Google サービスアカウントの秘密鍵
    R2_BUCKET: R2Bucket; // Cloudflare WorkersからバインドされるR2バケット（ネイティブbinding。S3互換のアクセスキー等はコードから未参照のため保持しない）
    // CORS設定
    CORS_ALLOWED_ORIGINS?: string; // CORS許可オリジン（カンマ区切り）
    // レート制限（オプショナル: ローカル/テスト環境では未設定の場合あり）
    RATE_LIMITER?: RateLimit; // Cloudflare Rate Limiting API バインディング（読み取り系: GET/HEAD等）
    RATE_LIMITER_WRITE?: RateLimit; // Cloudflare Rate Limiting API バインディング（書き込み系: POST/PUT/DELETE、SEC-013）
    // バッチWorker用（batch パッケージが使用）・api→scraping方向のバックフィル呼び出し用（api パッケージも使用）
    SCRAPING_API_URL?: string; // スクレイピングAPIのベースURL
    MAIN_API_URL?: string; // メインAPI（データ登録）のベースURL（batch / scraping / calendar が使用）
    CALENDAR_API_URL?: string; // カレンダー同期WorkerのベースURL（batch が使用）
    // GitHub通知用（scraping / api パッケージが使用・オプション）
    GITHUB_TOKEN?: string; // 未対応ステージ検出（scraping）・データ鮮度チェック（api, CICD-121）でのIssue作成に使用
    // Web Push用（api パッケージのみ使用。VAPID鍵はscripts/generateVapidKeys.tsで生成）
    VAPID_PUBLIC_KEY?: string; // VAPID公開鍵（Base64URL、非機密）
    VAPID_PRIVATE_KEY?: string; // VAPID秘密鍵（JWKのdパラメータ、Base64URL、機密）
    VAPID_SUBJECT?: string; // VAPID JWTのsubクレーム（例: mailto:...）
    PUSH_DISPATCH_TOKEN?: string; // POST /push/dispatch の認証共有シークレット
    PUSH_AUTH_ENCRYPTION_KEY?: string; // 購読authの暗号化鍵（AES-256-GCM、Base64URL 32バイト、SEC-053）。未設定時はauthを平文のまま保存（fail-open）
    // サービス間認証用（api / batch / scraping / calendar 全パッケージが使用）
    SERVICE_AUTH_TOKEN?: string; // サービス間認証の共有シークレット（service-auth-design.md §4.4）
    SERVICE_AUTH_TOKEN_PREVIOUS?: string; // ローテーション期間中のみ設定する旧シークレット（同 §8.1）
    // Workflows用（batch パッケージのみ使用、CICD-73）
    BATCH_ALL_WORKFLOW?: Workflow; // batch-all.yml のCloudflareネイティブcron移行版Workflowバインディング（test環境先行登録）
    // Cloudflare Analytics監視用（api パッケージのみ使用、CICD-122）
    CLOUDFLARE_ANALYTICS_API_TOKEN?: string; // error-monitor.ymlのWorker側移行用。Account Analytics:Read権限のみのfine-grainedトークン（デプロイ用トークンとは別スコープ）。APIトークンのスコープ整理により、デプロイ権限を持つトークンへのフォールバックは持たない
    CLOUDFLARE_ACCOUNT_ID?: string; // 上記トークンと組み合わせてGraphQL Analytics APIのaccountTagとして使う
    // Server-Driven UI (SDUI) 機能フラグ用（api パッケージのみ使用、feature-flag-design.md）。
    // D1（feature_flag テーブル）に行が無いキーの既定値として使われる。機能ごとに
    // 独立したキーを持つことで、SDUI機能を1つずつ個別に展開できるようにする。
    FEATURE_ANNOUNCEMENT_BANNER_ENABLED?: string; // 起動時お知らせバナー（announcementUsecase）の既定値
    // パスキー(WebAuthn)認証用（api パッケージのみ使用）
    WEBAUTHN_RP_ID?: string; // Relying Party ID（frontのホスト名、例: race-schedule-front.pages.dev）
    WEBAUTHN_RP_NAME?: string; // 認証器のUIに表示されるサービス名
}
