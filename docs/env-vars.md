# 環境変数一覧

> リポジトリ内で実際に参照されている環境変数・定数のアグリゲーション。
> テンプレートとしての一次情報源は [`.env.example`](../.env.example)、CI用シークレットの
> 台帳は [`packages/README.md`](../packages/README.md) の「環境変数管理」節。本ファイルは
> 「コードのどこで・どんな値として読まれているか」を横断的に一覧化したもの。

## アプリケーション実行時に参照される変数

| 変数名 | 読み取り箇所 | 既知/有効な値 | 用途 |
| --- | --- | --- | --- |
| `NODE_ENV` | `packages/core/src/utilities/appLogger.ts`（`isProductionEnvironment`）, `packages/core/src/utilities/logger.ts`, `packages/core/src/utilities/sanitizeLog.ts`, `package.json` scripts, `.env.example` | `local`（`.env.example` 既定）, `ci_local`（`bun run test` 系, ローカルCI相当）, `ci_github_actions`（GitHub Actions）, `production` | 実行環境の判定。`production` でログ抑制・サニタイズ挙動を切替、`ci_local` でログ抑制 |
| `ENVIRONMENT` | `packages/core/src/utilities/appLogger.ts`（`isProductionEnvironment`） | `production` | `NODE_ENV` と同等に production 判定へ使われる代替キー |
| `LOG_LEVEL` | `packages/core/src/utilities/appLogger.ts`（`isDebugLoggingEnabled`） | `debug` | production環境でも再デプロイ無しでdebugログを有効化する一時フラグ |
| `WORKER_NAME` | `packages/core/src/utilities/appLogger.ts` | 各 Worker 名（`wrangler.toml` の `[env.*.vars]` で設定） | 設定時のみJSON構造化ログを出力（Cloudflare Workers Logsでのフィルタ用, OBS-001） |
| `USE_IN_MEMORY_DB` | `packages/api/src/utility/isUseInMemoryDb.ts`（`isEnvFlagTrue` 経由） | `true` / 未設定 | trueならD1の代わりにインメモリDB実装を使用。`bun run test:component` が設定 |
| `USE_LOCAL_FILE_R2` | `packages/scraping/src/utility/isUseLocalFileR2.ts`（`isEnvFlagTrue` 経由） | `true` / 未設定 | trueならR2の代わりにローカルファイルシステム実装を使用 |
| `HTML_FETCH_DELAY_MS` | `packages/scraping/src/utility/delayFetch.ts` | 数値（ミリ秒）。未設定/非数値時は既定1000ms。`.env.example` 既定300、テストスクリプトは0 | スクレイピング先への負荷軽減用の取得前遅延 |
| `SCRAPING_API_URL` | `packages/scraping/src/utility/mainApiConfig.ts`, `packages/batch/src/types.ts`, `.env.example` | URL（例: `http://localhost:8786`） | batch/calendar が scraping Worker を呼び出す際のベースURL |
| `MAIN_API_URL` | `packages/calendar/src/utility/mainApiConfig.ts`, `packages/admin/src/utility/mainApiConfig.ts`, `packages/scraping/src/utility/mainApiConfig.ts`, `packages/batch/src/types.ts`, `.env.example` | URL（例: `http://localhost:8001`） | scraping/calendar/admin/batch がメインAPI（`api`）を呼び出す際のベースURL |
| `CALENDAR_API_URL` | `packages/batch/src/types.ts`, `packages/core/src/utilities/platform/cloudFlareEnv.ts` | URL | batch が calendar Worker（同期エンドポイント）を呼び出す際のベースURL |
| `CORS_ALLOWED_ORIGINS` | `packages/core/src/http/cors.ts`, `packages/batch/src/router.ts`, `.env.example` | カンマ区切りのオリジン一覧（例: `http://localhost:3000,http://localhost:3001`） | CORS許可オリジンの設定 |
| `SERVICE_AUTH_TOKEN` | `packages/core/src/http/serviceAuth.ts`, `packages/core/src/http/serviceAuthMiddleware.ts`, `.env.example` | ランダムな共有シークレット文字列（例: `openssl rand -base64 32`） | Worker間サービス間認証（`X-Service-Auth-Token`ヘッダ）。詳細は[`docs/specs/SPEC-API-001.md`](specs/SPEC-API-001.md) |
| `SERVICE_AUTH_TOKEN_PREVIOUS` | `packages/core/src/http/serviceAuthMiddleware.ts`, `.env.example`（コメントアウト） | 旧トークン文字列 | `SERVICE_AUTH_TOKEN` ローテーション期間中のみ設定する旧値 |
| `FEATURE_ANNOUNCEMENT_BANNER_ENABLED` | `packages/api/src/usecase/implement/featureFlagUsecase.ts`（`isEnvFlagTrue` 経由） | `true` / 未設定 | 起動時お知らせバナー（SDUI PoC）の既定値。D1（`feature_flag`テーブル）に行が無いときのみ参照される（[`feature-flag-design.md`](../aidlc-docs/inception/application-design/feature-flag-design.md)） |
| `GITHUB_OWNER` | `packages/core/src/gateway/githubIssueGateway.ts` | GitHubオーナー名。未設定時デフォルト `taichi6930` | Issue作成先リポジトリのオーナー |
| `GITHUB_REPO` | `packages/core/src/gateway/githubIssueGateway.ts` | リポジトリ名。未設定時デフォルト `race-scheduler` | Issue作成先リポジトリ名（2026-08-16のapi/batch/db/front/admin移行に伴い、デフォルトを移行元の`race-schedule`から本リポジトリへ変更した。Issue #2549参照） |
| `GITHUB_TOKEN` | `packages/batch/src/workflows/notifyBatchWorkflowFailure.ts`, `packages/api/src/utility/dataFreshnessNotifier.ts` | GitHub APIトークン文字列 | GitHub Issue通知機能の認証（batch: Workflow失敗通知、api: データ鮮度チェック[CICD-121]）。トークン種別ごとの使い分け・発行元は[`packages/README.md`](../packages/README.md#githubトークンの使い分け種類権限スコープ使用箇所)参照 |
| `JRA_CALENDAR_ID` / `NAR_CALENDAR_ID` / `OVERSEAS_CALENDAR_ID` / `KEIRIN_CALENDAR_ID` / `AUTORACE_CALENDAR_ID` / `BOATRACE_CALENDAR_ID` | `packages/core/src/utilities/platform/validateEnv.ts`（`API_REQUIRED_KEYS`）, `.env.example` | Google CalendarのカレンダーID文字列 | api Worker起動時の必須環境変数（Google Calendar連携）。未設定は起動時エラー |
| `WORLD_CALENDAR_ID` | `packages/core/src/utilities/platform/validateEnv.ts` | カレンダーID文字列 | `OVERSEAS_CALENDAR_ID` の旧キー。未設定時のフォールバックとして後方互換で読み取り可 |
| `GOOGLE_CLIENT_EMAIL` | `packages/core/src/utilities/platform/validateEnv.ts`, `.env.example` | サービスアカウントのメールアドレス | Google Calendar API認証 |
| `GOOGLE_PRIVATE_KEY` | `packages/core/src/utilities/platform/validateEnv.ts`, `.env.example` | PEM形式（`-----BEGIN`始まり）またはBase64文字列（44文字以上） | Google Calendar APIサービスアカウント秘密鍵。フォーマット不正は起動時エラー |
| `TZ` | `package.json` scripts | `jst` | テスト実行時のタイムゾーン固定 |

## CI/デプロイ用（GitHub Secrets）

以下はコード内で直接 `process.env` として読まれるのではなく、CIワークフロー
（`envsubst`）や `wrangler.toml` を経由して上記アプリケーション変数へ注入される
シークレット、またはデプロイ・インフラ操作専用の値。台帳は
[`packages/README.md`](../packages/README.md#環境変数管理) を一次情報源とする。

| 変数名 | 用途 |
| --- | --- |
| `CLOUDFLARE_WORKERS_API_TOKEN` / `CLOUDFLARE_PAGES_API_TOKEN` / `CLOUDFLARE_D1_API_TOKEN` / `CLOUDFLARE_ANALYTICS_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | Cloudflareへのデプロイ・D1操作・Pages配信・エラー監視。用途ごとにスコープを分けたfine-grainedトークン（詳細は[`packages/README.md`](../packages/README.md#環境変数管理)） |
| `DB_ID` / `DB_ID_DEV` | D1 Database ID（環境ごと） |
| `PUSH_DISPATCH_TOKEN` | `POST /push/dispatch` 専用の認証トークン |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push VAPID鍵・JWT sub |
| `BOT_APP_ID` / `BOT_PRIVATE_KEY` / `PERSONAL_ACCESS_TOKEN` / `ISSUE_BOT_TOKEN` | GitHub認証各種（用途・権限スコープ・使い分けの原則は[`packages/README.md`](../packages/README.md#githubトークンの使い分け種類権限スコープ使用箇所)参照） |

## 備考

- `USE_IN_MEMORY_DB` / `USE_LOCAL_FILE_R2` はいずれも `packages/core/src/utilities/platform/envFlag.ts`
  の `isEnvFlagTrue` を経由し、「Cloudflare Workers の `env`（`c.env`）→なければ `process.env`」の
  順で判定する共通パターンに従う。
- `MAIN_API_URL` 等の一部URL変数は `EnvStore`（Workerモード）を優先し、`process.env` は
  ローカル実行時のフォールバックとして参照される（例: `packages/calendar/src/utility/mainApiConfig.ts`）。
