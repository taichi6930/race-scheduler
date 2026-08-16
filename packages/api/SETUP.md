# race-schedule-api セットアップガイド

## 概要

このドキュメントは、Cloudflare Workers上で `@race-schedule/api` を動かすためのセットアップ手順を説明します。

`@race-schedule/api` は **D1（SQLite）唯一のアクセス点** です。Google Calendar 連携は `@race-schedule/calendar` Worker に分離されているため、Google Calendar 関連のセットアップ（サービスアカウント、Calendar ID 等）が必要な場合は [../calendar/SETUP.md](../calendar/SETUP.md) を参照してください。

## 必要な環境変数

`api` は D1 のみを使い、R2 などの外部ストレージには接続しません（R2 を使うのは `scraping` Worker）。

### サービス間認証（SERVICE_AUTH_TOKEN）

api の書き込み系エンドポイント（`POST /place`, `POST /race` 等）と一部Worker間エンドポイントは
既定でサービス間認証が必須（deny-by-default、[`docs/specs/SPEC-API-001.md`](../../docs/specs/SPEC-API-001.md)）。
`SERVICE_AUTH_TOKEN` が未設定の場合、これらは常に `401 Unauthorized` を返す
（フェイルクローズ。免除ルートである `GET /place` 等は影響を受けない）。

ローカルでWorker間通信（scraping/calendar/batch から api への呼び出し）を再現するには、
呼び出し側・受け側の `.dev.vars`（または `.env`）に**同じ値**の `SERVICE_AUTH_TOKEN` を設定する。

```bash
# ランダムな値を生成する例（実際に使う値はここに書かず、生成して各自の .dev.vars に設定する）
openssl rand -base64 32
```

```
# packages/api/.dev.vars（呼び側の scraping/calendar/batch も同じ値にする）
SERVICE_AUTH_TOKEN=<上記で生成した値>
```

### バックフィル機能（SCRAPING_API_URL）

`POST /internal/backfill/place` ・ `POST /internal/backfill/race`（管理画面
（`packages/admin`）から実行できる、R2キャッシュのみでの再同期機能）は、api が scraping Worker の
`POST /sync/place` ・ `POST /sync/race` を `cacheOnly: true` 付きで内部的に呼び出す。
この呼び出し先URLを `SCRAPING_API_URL` で指定する必要がある（`batch`/`scraping` が
使う `MAIN_API_URL`/`SCRAPING_API_URL` と同じ変数を、api→scraping方向の呼び出しにも
流用する）。認証は既存の `SERVICE_AUTH_TOKEN`（呼び出し先の scraping と同じ値）を
そのまま使うため、追加のシークレットは不要。

```
# packages/api/.dev.vars
SCRAPING_API_URL=http://localhost:8786
```

未設定の場合、`POST /internal/backfill/*` はエラーになる（他のエンドポイントには影響しない）。

### Web Push（VAPID）

タブを閉じていても発走前通知が届く Web Push 機能に必須です。未設定でもデプロイ自体は失敗しませんが、通知APIが実行時エラーになります。

- **VAPID_PUBLIC_KEY**: VAPID公開鍵（Base64URL、非圧縮点）
- **VAPID_PRIVATE_KEY**: VAPID秘密鍵（JWK `d` パラメータ、Base64URL）
- **VAPID_SUBJECT**: VAPID JWT の `sub`（`mailto:` または `https://` で始まる連絡先）
- **PUSH_DISPATCH_TOKEN**: `POST /push/dispatch`（発火予約の手動ディスパッチ）を叩く際の認証トークン

### D1

`wrangler.toml` の `[[d1_databases]]` バインディングで管理されており、環境変数としての設定は不要です（`database_id` はCI上で `${DB_ID}` として `envsubst` 置換されます）。

## セットアップ手順

### 1. `.dev.vars` ファイルの作成

`.dev.vars.example`をコピーして、実際の値を入力します：

```bash
cp packages/api/.dev.vars.example packages/api/.dev.vars
```

### 2. Cloudflare Secretsに登録

#### test環境への登録

```bash
cd packages/api
./scripts/setup-secrets.sh test
```

#### production環境への登録

```bash
cd packages/api
./scripts/setup-secrets.sh production
```

### 3. 登録内容の確認

```bash
# test環境の確認
wrangler secret list --env test

# production環境の確認
wrangler secret list --env production
```

## デバッグ

### ログ確認

```bash
# test環境のログ
wrangler tail race-schedule --env test

# production環境のログ
wrangler tail race-schedule --env production
```

## 参考

- [Cloudflare Workers秘密設定](https://developers.cloudflare.com/workers/configuration/secrets/)
- [wrangler CLIドキュメント](https://developers.cloudflare.com/workers/wrangler/)
- [calendar-extraction-design.md](../../aidlc-docs/inception/reverse-engineering/calendar-extraction-design.md) — Google Calendar 連携を calendar Worker へ分離した経緯

---

## インメモリDBでローカル開発

### 概要

D1 を立ち上げずに、メモリ上のDB でローカル開発・テストができます。

### クイックスタート

```bash
# インメモリDB を使用してサーバー起動
bun run dev:memory
```

これで `http://localhost:8787` でAPIが利用できます。テストデータは直接メモリに挿入できます。

### 詳細

- 使用方法・レイヤー別ガイドは [.claude/docs/testing-conventions.md](../../.claude/docs/testing-conventions.md) §7 を参照
- 環境変数: `USE_IN_MEMORY_DB=true`
- wrangler環境: `env.local`（`dev:memory`スクリプトで自動選択）

### 利用シーン

- **ローカルテスト**: D1が不要でシンプルな環境構築
- **統合テスト**: Repository層の動作確認
- **CI/CD**: テスト環境でのすばやいテスト実行
