# Batch ローカルセットアップガイド

バッチ処理をローカル環境で実行するためのセットアップ手順です。

## 前提条件

- Node.js 18+ または bun がインストールされていること
- 開発環境の API が稼働していること（Cloudflare Workers）

## クイックセットアップ

### 方法1：セットアップスクリプトを使用（推奨）

```bash
# ルートディレクトリから実行
cd packages/batch
bash setup.sh
```

このスクリプトが以下を自動実行します：

- ワークスペース依存関係のインストール
- `packages/batch` のビルド

### 方法2：手動セットアップ

```bash
# 1. ワークスペース全体の依存関係をインストール
cd <workspace-root>
bun install

# 2. packages/batch をビルド
cd packages/batch
bun run build
```

## ローカル実行

### 基本的な実行方法

```bash
cd packages/batch

# Place batch: 開催地情報を取得・登録
bun src/cli.ts nar "2026-03-13" "2026-03-14" place

# Race batch: レース情報を取得・登録
bun src/cli.ts nar "2026-03-13" "2026-03-14" race

# Calendar batch: カレンダー情報を更新
bun src/cli.ts nar "2026-03-13" "2026-03-14" calendar

# All batch: place → race → calendar を順序実行
bun src/cli.ts nar "2026-03-13" "2026-03-14" all
```

### レース種別

- `nar`: 地方競馬
- `autorace`: オートレース
- `keirin`: 競輪

### 引数

```
Usage: bun src/cli.ts <raceType> <startDate> <finishDate> <batchTarget>

Arguments:
  raceType     : nar | autorace | keirin
  startDate    : YYYY-MM-DD 形式の開始日
  finishDate   : YYYY-MM-DD 形式の終了日
  batchTarget  : place | race | calendar | all
```

## 実行例

```bash
# 2026-03-13 から 2026-03-14 の NAR の place batch を実行
cd packages/batch
bun src/cli.ts nar "2026-03-13" "2026-03-14" place
```

### 期待される出力

```
==========================================
        Batch Processing Started
==========================================
Target: place
RaceType: nar
Period: 2026-03-13 ~ 2026-03-14
Scraping API: <SCRAPING_API_URL の値>
Main API: <MAIN_API_URL の値>
==========================================

Executing place batch...
=== Place Batch: nar 2026-03-13 ~ 2026-03-14 ===
[DEBUG] Scraping API URL: <SCRAPING_API_URL>/place?...
[DEBUG] API Config: {...}
[DEBUG] Sending HTTP request to: <MAIN_API_URL>/place
Upserted 116 places
PLACE Batch Result: success=116, failure=0, duration=1640ms

==========================================
        Batch Processing Complete
==========================================
[place] Success: 116, Failure: 0
------------------------------------------
Total: Success: 116, Failure: 0
==========================================
```

## API 設定

バッチ処理は `SCRAPING_API_URL` / `MAIN_API_URL` 環境変数で接続先を指定します。
**環境変数が未設定の場合は起動時にエラーとなります。**

| 環境変数              | 説明                                                          |
| ---------------------- | -------------------------------------------------------------- |
| `SCRAPING_API_URL`     | スクレイピング API のベース URL                                |
| `MAIN_API_URL`         | メイン API のベース URL                                        |
| `SERVICE_AUTH_TOKEN`   | Worker間サービス間認証トークン（`X-Service-Auth-Token`）。`api`/`scraping`/`calendar`側と同じ値でないと全リクエストが`401`になる。詳細は[`../api/SETUP.md`](../api/SETUP.md#サービス間認証service_auth_token) |

ルートの `.env.example` を参照し、`.env` ファイルに値を設定してください。

```bash
# .env の設定例
SCRAPING_API_URL=http://localhost:8786   # ローカル開発用
MAIN_API_URL=http://localhost:8001       # ローカル開発用
SERVICE_AUTH_TOKEN=<api/scraping/calendarと同じ値>
```

### 実行前に環境変数を確認

```bash
env | grep -E "SCRAPING_API_URL|MAIN_API_URL"

bun src/cli.ts nar "2026-03-13" "2026-03-14" place
```

## トラブルシューティング

### 404 エラーが出る

**症状**:

```
Error: API ***/place returned 404: Page not found
```

**原因**: API エンドポイントが応答していない、または不正な URL が使用されている

**対応**:

1. 開発環境の Cloudflare Workers が起動しているか確認
2. `packages/batch/src/types.ts` の デフォルト URL を確認
3. 環境変数が正しく設定されているか確認

```bash
# 環境変数を確認
env | grep -E "SCRAPING_API_URL|MAIN_API_URL"
```

### ビルドエラーが出る

```bash
# packages/core をリビルド
cd packages/core
bun run build

# キャッシュをクリア
rm -rf node_modules/.cache
bun install
```

### タイムアウトエラー

**症状**:

```
Error: Request timeout after 30000ms
```

**対応**:

- ネット接続を確認
- API サーバーの状態を確認
- 日付範囲を縮小（例：1日のみに限定）してテスト

## GitHub Actions での実行

PR 作成時に自動的に batch validation が実行されます。

PR の CI/CD ログで実行結果を確認できます。

### トリガー条件

以下のいずれかが変更されると batch-pr-validation が実行：

- `packages/batch/**`
- `packages/api/**`
- `packages/scraping/**`

## 参考資料

- [Batch README](./README.md)
- [API Setup](../api/SETUP.md)
- [Scraping Setup](../scraping/SETUP.md)
