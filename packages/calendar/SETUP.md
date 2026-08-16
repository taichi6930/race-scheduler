# Calendar Worker Setup Guide

このドキュメントは、`@race-schedule/calendar` のセットアップ手順を説明します。

## 前提条件

- Bun がインストール済み
- Cloudflareアカウント
- Google Cloud のサービスアカウント（Google Calendar API 有効化済み）
- ルートワークスペースの依存関係がインストール済みであること

## パッケージのインストール

ルートディレクトリから以下を実行:

```bash
bun install
```

## ローカル開発のセットアップ

### 1. Cloudflareに認証

```bash
wrangler login
```

### 2. `.dev.vars` の作成

`packages/calendar/.dev.vars`（gitignore 済み）を作成し、以下を設定します。

```
MAIN_API_URL=http://localhost:8787
GOOGLE_CLIENT_EMAIL=xxxx@xxxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JRA_CALENDAR_ID=xxxx@group.calendar.google.com
NAR_CALENDAR_ID=xxxx@group.calendar.google.com
OVERSEAS_CALENDAR_ID=xxxx@group.calendar.google.com
KEIRIN_CALENDAR_ID=xxxx@group.calendar.google.com
AUTORACE_CALENDAR_ID=xxxx@group.calendar.google.com
BOATRACE_CALENDAR_ID=xxxx@group.calendar.google.com
```

Google サービスアカウントの発行・各カレンダーへの共有設定は、元々 `@race-schedule/api` で行っていた手順と同じです（Google Cloud Console でサービスアカウントを作成し、対象の Google Calendar に編集者権限で共有する）。

さらに `SERVICE_AUTH_TOKEN` を追加する。`calendar` は `GET /health`（と `OPTIONS`）以外の
全エンドポイントでサービス間認証が必須（deny-by-default、
[`docs/specs/SPEC-API-001.md`](../../docs/specs/SPEC-API-001.md)）。呼び出し先の `api`
（`GET /race`, `GET /calendar/flag` 等）と同じ値にする必要があるため、`api`側の
[`SETUP.md`](../api/SETUP.md#サービス間認証service_auth_token)と揃えること。

```
SERVICE_AUTH_TOKEN=<apiと同じ値>
```

### 3. 開発サーバーの起動

```bash
bun run dev
```

`packages/calendar/wrangler.toml` の `[dev]` 設定により、ローカルのポート 8788 で起動します。

### 4. エンドポイントのテスト

```bash
# ヘルスチェック（認証不要）
curl "http://localhost:8788/health"

# 同期実行（認証必須。要: メインAPIがローカルまたは到達可能な状態で起動していること）
curl -X POST "http://localhost:8788/sync" \
  -H "Content-Type: application/json" \
  -H "X-Service-Auth-Token: $SERVICE_AUTH_TOKEN" \
  -d '{"startDate":"2026-01-01","finishDate":"2026-01-31","raceTypeList":["jra"]}'
```

## テストの実行

```bash
# 全テスト実行
bun test

# Watch モード
bun test:watch

# カバレッジレポート
bun test --coverage
```

## デプロイ

### GitHub Secrets / Variables

現時点では calendar Worker 専用のデプロイワークフローは未整備です（[README.md](README.md) 参照）。手動デプロイする場合は以下の Secrets を Cloudflare に登録してください。

```bash
wrangler secret put MAIN_API_URL --env production
wrangler secret put GOOGLE_CLIENT_EMAIL --env production
wrangler secret put GOOGLE_PRIVATE_KEY --env production
wrangler secret put JRA_CALENDAR_ID --env production
wrangler secret put NAR_CALENDAR_ID --env production
wrangler secret put OVERSEAS_CALENDAR_ID --env production
wrangler secret put KEIRIN_CALENDAR_ID --env production
wrangler secret put AUTORACE_CALENDAR_ID --env production
wrangler secret put BOATRACE_CALENDAR_ID --env production
```

### 手動デプロイ

```bash
bun run deploy:development
bun run deploy:test
bun run deploy:production
```

## トラブルシューティング

### `Invalid or empty calendarId for raceType` エラー

対象レース種別の `*_CALENDAR_ID` 環境変数が未設定、または Google Calendar の group calendar ID 形式（`xxxx@group.calendar.google.com`）になっていません。

### `GOOGLE_PRIVATE_KEY is not set` エラー

`.dev.vars` またはシークレットに `GOOGLE_PRIVATE_KEY` が設定されていません。改行は `\n` エスケープで1行にまとめて設定してください。

### メインAPIへの接続エラー

`MAIN_API_URL` が正しいか、対象のメインAPI Worker が起動・デプロイされているかを確認してください。

## 関連ドキュメント

- [README.md](README.md) — パッケージ概要・エンドポイント仕様
- [calendar-extraction-design.md](../../aidlc-docs/inception/reverse-engineering/calendar-extraction-design.md) — カレンダー機能をWorkerとして分離した設計の背景
