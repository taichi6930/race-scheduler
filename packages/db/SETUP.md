# DB デプロイサイクル セットアップガイド

このガイドでは、Cloudflare D1を使用したDBのデプロイサイクルをセットアップする手順を説明します。

## 前提条件

- Cloudflareアカウント
- GitHub リポジトリ
- Bun がインストールされていること

## 1. Cloudflare D1 データベースの作成

### テスト環境用データベース

```bash
# Cloudflareにログイン
wrangler login

# テスト環境用データベースを作成
wrangler d1 create race-schedule-db-test
```

作成後、表示される `database_id` をメモしておきます。

### 本番環境用データベース

```bash
# 本番環境用データベースを作成
wrangler d1 create race-schedule-db-production
```

同様に `database_id` をメモしておきます。

## 2. wrangler.toml の更新

`packages/db/wrangler.toml` を開き、各環境の `database_id` を更新します：

```toml
# Test Environment
[env.test]
[[env.test.d1_databases]]
binding = "DB"
database_name = "race-schedule-db-test"
database_id = "ここにテスト環境のdatabase_idを入力"
migrations_dir = "./migrations"

# Production Environment
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "race-schedule-db-production"
database_id = "ここに本番環境のdatabase_idを入力"
migrations_dir = "./migrations"
```

## 3. GitHub Secrets の設定

GitHubリポジトリの Settings > Secrets and variables > Actions で以下のシークレットを追加します：

### 必要なシークレット

1. **CLOUDFLARE_D1_API_TOKEN**
    - Cloudflareダッシュボード > My Profile > API Tokens で作成
    - 必要な権限: `D1:Edit`のみ（他パッケージのデプロイ用`CLOUDFLARE_WORKERS_API_TOKEN`とは別トークンにすること）

2. **CLOUDFLARE_ACCOUNT_ID**
    - Cloudflareダッシュボード > Workers & Pages で確認できます
    - URLの `https://dash.cloudflare.com/` の後に表示される文字列

### GitHub Environments の設定

Settings > Environments で以下の環境を作成：

1. **test**
    - Protection rules: 任意（推奨: mainブランチのみ）

2. **production**
    - Protection rules: Required reviewers（推奨）
    - タグからのデプロイ時のみ実行されるため

## 4. ローカル環境のセットアップ

```bash
cd packages/db
./setup-local.sh
```

または手動で：

```bash
cd packages/db
bun run migrations:apply:local
```

## 5. デプロイフローの確認

### テスト環境へのデプロイ

1. `packages/db/` 配下を変更
2. 変更をコミット & プッシュ
3. `main` ブランチにマージ
4. GitHub Actions が自動的にテスト環境へデプロイ

### 本番環境へのデプロイ

1. GitHubでリリースを作成し、タグを作成（例: `v1.0.0`）
2. 前回のタグと比較して `packages/db/` に変更がある場合
3. GitHub Actions が自動的に本番環境へデプロイ

## 6. 動作確認

### ローカル

```bash
cd packages/db
bun run db:shell:local
# SQLiteシェルが開きます
```

### テスト環境

```bash
cd packages/db
bun run migrations:list:test
```

### 本番環境

```bash
cd packages/db
bun run migrations:list:production
```

## トラブルシューティング

### GitHub Actions が実行されない

- `packages/db/` 配下に変更があることを確認
- GitHub Secrets が正しく設定されていることを確認

### マイグレーションが失敗する

- `database_id` が正しいことを確認
- Cloudflare API Token に `D1:Edit` 権限があることを確認

### ローカルでマイグレーションが実行できない

- Wranglerがインストールされているか確認: `wrangler --version`
- `bun install` を実行

## 参考リンク

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
