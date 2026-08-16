# Admin Worker Setup Guide

このドキュメントは、`@race-schedule/admin` のセットアップ手順を説明します。

## 前提条件

- Bun がインストール済み
- Cloudflareアカウント
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

`packages/admin/.dev.vars`（gitignore 済み）を作成し、以下を設定します。

```
MAIN_API_URL=http://localhost:8787
SERVICE_AUTH_TOKEN=<apiと同じ値>
```

`SERVICE_AUTH_TOKEN` は呼び出し先の `api`（`/internal/feature-flags`）と同じ値にする必要があります。`api`側の [`SETUP.md`](../api/SETUP.md#サービス間認証service_auth_token)と揃えること。

### 3. 開発サーバーの起動

```bash
bun run dev
```

`packages/admin/wrangler.toml` の `[dev]` 設定により、ローカルのポート 8790 で起動します。

### 4. エンドポイントのテスト

```bash
# ヘルスチェック
curl "http://localhost:8790/health"

# 機能フラグ管理画面
open "http://localhost:8790/flags"
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

### Cloudflare Access の設定（初回のみ・手動）

このWorkerは Cloudflare Access（Zero Trust）によりホスト名全体を保護する前提です。デプロイ後にダッシュボード側で以下を設定してください（旧 `packages/api` 内蔵版から Worker名を据え置いているため、既に設定済みの場合は再設定不要です）。

1. Cloudflareダッシュボード → 対象Workerの Settings → Domains & Routes → workers.dev の項目で **Enable Cloudflare Access** を有効化する。
2. **Manage Cloudflare Access** から、許可するメールアドレスを自分のものだけに絞る。

### 手動デプロイ

```bash
bun run deploy:test
bun run deploy:production
```

## トラブルシューティング

### メインAPIへの接続エラー

`MAIN_API_URL` が正しいか、対象のメインAPI Worker が起動・デプロイされているかを確認してください。

### 401 Unauthorized（メインAPI呼び出し時）

`SERVICE_AUTH_TOKEN` が `api` 側と一致しているか確認してください。

## 関連ドキュメント

- [README.md](README.md) — パッケージ概要・エンドポイント仕様
- [admin-package-design.md](../../aidlc-docs/inception/application-design/admin-package-design.md) — 設計の背景
