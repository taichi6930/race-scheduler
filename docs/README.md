# race-schedule ドキュメント

公営競技のレーススケジュールを管理するモノレポの統合ドキュメントです。

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [技術スタック・前提条件](#2-技術スタック前提条件)
3. [パッケージ構成](#3-パッケージ構成)
4. [ローカル開発セットアップ](#4-ローカル開発セットアップ)
5. [API仕様](#5-api仕様)
6. [データベーススキーマ概要](#6-データベーススキーマ概要)
7. [デプロイ・Secrets管理](#7-デプロイsecrets管理)
8. [テスト](#8-テスト)
9. [セキュリティポリシー](#9-セキュリティポリシー)
10. [ロードマップ・タスク](#10-ロードマップタスク)

---

## 1. プロジェクト概要

以下の公営競技のレーススケジュール・レース情報・開催場所情報を取得・管理する API を提供します。

- **JRA**（日本中央競馬会）
- **NAR**（地方競馬）
- **海外競馬**
- **競輪**
- **競艇**
- **オートレース**

レース情報を Google Calendar に連携し、スケジュール管理を自動化します。

---

## 2. 技術スタック・前提条件

### 技術スタック

| 分類               | 技術                            |
| ------------------ | ------------------------------- |
| ランタイム         | Cloudflare Workers              |
| データベース       | Cloudflare D1（SQLite互換）     |
| ストレージ         | Cloudflare R2                   |
| 言語               | TypeScript                      |
| パッケージマネージャ | Bun                            |
| 外部API            | Google Calendar API             |
| CI/CD              | GitHub Actions                  |

### 前提条件

- **Node.js**: `>=24.0.0 <25.0.0`（`.nvmrc` で管理）
- **Bun**: `package.json` の `packageManager` フィールドで固定（Dependabotが追従するため、
  具体的なバージョン番号は本ドキュメントに書かず同フィールドを参照する）

```bash
# Node.js バージョン切り替え（nvm利用時）
nvm use
```

---

## 3. パッケージ構成

`core`（共有ドメイン・ユーティリティ）を、`api`（メインAPI）・`batch`（バッチ処理）・
`scraping`（スクレイピング）・`calendar`（Google Calendar同期）が利用する構成。
`db`はマイグレーション専用、`front`（Flutter）はHTTP契約のみでapiと結合する。

パッケージ一覧・依存関係図・レイヤーアーキテクチャ・barrel（`index.ts`）配置方針の詳細は
[`packages/README.md`](../packages/README.md#パッケージ構成) を参照
（barrelの詳細規約は [`.claude/docs/coding-conventions.md`](../.claude/docs/coding-conventions.md) §barrel）。

---

## 4. ローカル開発セットアップ

### インストール

```bash
bun install
```

### 環境変数

`.env.local` を作成し以下を設定します（`.env.example` 参照）。

```bash
# Google Calendar API
GOOGLE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Cloudflare
CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

### ローカルサーバー起動

`dev` 系スクリプトはルートではなく各パッケージ（`packages/api` 等）の `package.json` に定義されている。

```bash
cd packages/api

# インメモリDB を使用（Cloudflare D1 不要）
bun run dev:memory

# .dev.vars を使ったローカルWrangler（ローカルD1）
bun run dev:local

# Cloudflare上のtest環境（secrets, D1）にリモート接続
bun run dev
```

API は `http://localhost:8787` で利用できます。詳細は [`packages/api/README.md`](../packages/api/README.md) を参照。

### ログ確認（Wrangler Tail）

```bash
# ログイン
wrangler login

# ログ確認（development環境）
wrangler tail race-schedule-dev --config ./wrangler.effective.toml

# ログ確認（test環境）
wrangler tail race-schedule-test --config ./wrangler.effective.toml
```

または Cloudflare Dashboard（https://dash.cloudflare.com）から Workers → Logs で確認できます。

---

## 5. API仕様

### 基本情報

- **Base URL (ローカル)**: `http://localhost:8787`
- **デプロイ環境**: Cloudflare Workers
- **認証**: サービス間認証（`X-Service-Auth-Token` ヘッダ）が既定で必須（deny-by-default）。
  免除されるのは各 Worker の router に理由付きで明示列挙されたルートのみ
  （`front-public` = front が呼ぶ公開GET、`monitoring` = ヘルスチェック 等）。
  詳細な判定ロジック・免除区分・トークンのローテーション手順は
  [`docs/specs/SPEC-API-001.md`](specs/SPEC-API-001.md) を参照。

### エンドポイント一覧

api（`packages/api`）が公開する主なエンドポイント。「認証」列が `免除` のもの以外は
`X-Service-Auth-Token` ヘッダが必須（一致しない場合 `401 Unauthorized`）。

| メソッド | パス                   | 説明                                                        | 認証                     |
| -------- | ---------------------- | ------------------------------------------------------------ | ------------------------ |
| `GET`    | `/health`              | ヘルスチェック                                                | 免除（monitoring）       |
| `GET`    | `/calendar`            | カレンダー掲載対象レース＋フラグ状態取得（startDate, finishDate, raceTypeList） | 免除（front-public） |
| `GET`    | `/calendar/flag`       | カレンダー登録フラグ一覧取得                                  | 要                        |
| `POST`   | `/calendar/flag`       | カレンダー登録フラグ追加（D1保存のみ）                         | 要                        |
| `DELETE` | `/calendar/flag`       | カレンダー登録フラグ削除（D1削除のみ）                         | 要                        |
| `GET`    | `/place`               | 開催場情報取得（startDate, finishDate, raceTypeList）          | 免除（front-public）     |
| `GET`    | `/place/docs`          | `/place` の使い方（静的ドキュメント）                          | 免除（static-docs）      |
| `POST`   | `/place`               | 開催場情報作成・更新                                          | 要                        |
| `GET`    | `/race`                | レース情報取得（startDate, finishDate, raceTypeList）          | 免除（front-public）     |
| `GET`    | `/race/docs`           | `/race` の使い方（静的ドキュメント）                           | 免除（static-docs）      |
| `GET`    | `/race/calendar-event` | レースIDからカレンダーイベント情報を取得                       | 免除（front-public）     |
| `POST`   | `/race`                | レース情報作成・更新                                          | 要                        |
| `GET`    | `/player`              | 選手・騎手情報取得                                             | 免除（front-public）     |
| `POST`   | `/push/subscription`   | Web Push 購読登録                                             | 免除（pending-user-auth）|
| `DELETE` | `/push/subscription`   | Web Push 購読解除                                             | 免除（pending-user-auth）|
| `POST`   | `/push/request`        | お気に入りレースの発走前通知リクエスト登録                     | 免除（pending-user-auth）|
| `DELETE` | `/push/request`        | 発走前通知リクエスト削除                                       | 免除（pending-user-auth）|
| `POST`   | `/push/test`           | Web Push のテスト送信                                         | 免除（pending-user-auth）|
| `POST`   | `/push/dispatch`       | 発走前通知の一括送信（`PUSH_DISPATCH_TOKEN` による別認証）      | 免除（has-own-auth）      |
| `POST`   | `/player`              | 選手・騎手情報作成・更新                                       | 要                        |
| `GET`    | `/debug/database`      | デバッグ用DB件数取得。本番環境（`NODE_ENV`/`ENVIRONMENT`）では常に404、in-memory DB使用時（開発・テスト環境）のみ有効 | 免除（開発・テスト限定）  |

`免除（pending-user-auth）` はユーザー単位の認可へ将来移行する予定のルート（詳細は
[`push-ownership-design.md`](../aidlc-docs/inception/application-design/push-ownership-design.md)）。
実際の免除ルート一覧の正は `packages/api/src/router.ts` の `SERVICE_AUTH_EXEMPT_ROUTES`。
`scraping` / `calendar` / `batch` の各 Worker にも同様の認証が適用される
（各パッケージ README を参照）。

`POST /internal/batch-lock/acquire` / `release`（CICD-73/CONC-03のbatch実行排他制御ロック）は
batch Workerからのみ`X-Service-Auth-Token`経由で呼ばれる内部専用ルートのため、意図的に本表には
掲載しない（`packages/api/src/router.ts` の `registerBatchLockRoutes` のコメント参照）。

### 共通クエリパラメータ

- `startDate` (必須): 開始日付（YYYY-MM-DD）
- `finishDate` (必須): 終了日付（YYYY-MM-DD）
- `raceTypeList` (オプション): `jra` / `nar` / `keirin` / `autorace` / `boatrace` / `overseas`（カンマ区切りで複数指定可）

### エラーレスポンス

| ステータス | 説明                                      |
| ---------- | ----------------------------------------- |
| 400        | リクエストパラメータが無効                |
| 401        | サービス間認証トークンが不一致・未設定    |
| 405        | 非対応の HTTP メソッド                    |
| 413        | リクエストボディが 1MB 上限を超過         |
| 429        | レート制限超過                            |
| 500        | サーバー内部エラー                        |

```json
{
    "status": 400,
    "message": "Required parameter 'startDate' is missing"
}
```

---

## 6. データベーススキーマ概要

Cloudflare D1（SQLite互換）を使用。マイグレーションは `packages/db/migrations/` で管理。

| テーブル                     | 説明                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `place`                       | 開催場情報（ID・種別・日時・場所コード）                  |
| `place_grade`                 | 開催場グレード（G1, G2, G3 等）                           |
| `place_held_day`              | 開催予定日                                               |
| `place_master`                | 開催場マスター情報（レース種別・コースコード種別・場名）   |
| `race`                        | レース情報（ID・名称・番号・開始時刻）                    |
| `race_stage`                  | レースステージ（距離・コース種別等）                       |
| `race_condition`              | レース条件（馬場状態等）                                  |
| `player`                      | 選手・騎手情報                                           |
| `calendar_flag`               | カレンダー登録フラグ（Google Calendar 連携情報）           |
| `push_subscription`           | Web Push 購読（ブラウザ1つ = 1行）                        |
| `push_notification_request`   | Web Push の発火予約（購読 × レース）                       |

---

## 7. デプロイ・Secrets管理

- **Single Source of Truth: GitHub Secrets / Variables**。インフラ（D1・R2・Cloudflare
  Pages等）・Secretsともに、Cloudflare Dashboard・GitHub の管理画面から手動で作成・登録する
  （IaCツールは使用しない）。Cloudflare には secrets を保存しない（Binding経由で参照）。
- Secrets の一覧・デプロイフロー（トリガー・環境・ワークフロー構成）の詳細は
  [`packages/README.md`](../packages/README.md#環境変数管理) を参照。
  サービス間認証用の `SERVICE_AUTH_TOKEN` は §5 を参照。

---

## 8. テスト

### テスト戦略

| レイヤー | 略称 | 説明                              | 実行環境               |
| -------- | ---- | --------------------------------- | ---------------------- |
| 単体     | UT   | 1関数/1クラスを独立して検証       | bun test               |
| コンポーネント | Component  | 同一パッケージ内の複数層を結合    | bun test + InMemoryDB  |
| 外部結合 | sIT  | パッケージを跨いだ実体結合（miniflare 実D1/R2） | bun test               |
| シナリオ | E2E  | ビジネスシナリオを跨ぐ通しフロー  | **未整備**（`tests/e2e/` ディレクトリ・コマンドとも未実装。front は Flutter widget test で画面単位のE2E相当を代替） |
| 受け入れ | UAT  | デプロイ済みtest/production環境へのSmokeテスト | test/production        |

sIT・UAT は PR 毎には実行せず、`.github/workflows/scheduled-tests.yml` が定期実行する
（詳細は [`.claude/docs/testing-conventions.md`](../.claude/docs/testing-conventions.md) §7）。

### テスト結果の可視化（Allure Report）

PR・main の CI 実行結果は `.github/workflows/test-report.yml` が Allure Report としてまとめる。
bun の Inspector Protocol から実アサーション差分・実時刻・severity（レイヤー由来）を収集し、
`suite`/`parentSuite`階層・Behaviors/Categories/Overviewタブに反映する（Codecov は使用しない。
カバレッジ判定は次項の自前スクリプトが担う）。

### テストコマンド

```bash
# 全テスト（UT + Component）
bun run test

# 単体テストのみ
bun run test:unit

# コンポーネントテスト
bun run test:component

# システム統合テスト（sIT。ローカルではいつでも実行可）
bun run test:sit

# 受け入れテスト（UAT smoke。デプロイ済みtest環境Workerへの疎通確認）
bun run test:uat

# テストカバレッジ不足の分析
bun run test:gap
```

### テストディレクトリ構成

```
packages/<pkg>/test/
├── unittest/                   # UT
├── integration/
│   ├── component/               # コンポーネントテスト（InMemoryDB使用）
│   └── system/                 # sIT（実D1/R2使用）
└── common/                     # テストユーティリティ・モック

tests/                          # ルートレベル横断テスト
├── uat/smoke/                  # デプロイ済み環境へのスモークテスト
└── shared/                     # 共通ファクトリ・モック
```

front（Flutter）のテストは `packages/front/test/` に widget test として配置される
（TypeScript パッケージとは別のテストランナー）。

### カバレッジ要件

- `front` を除く全パッケージの `src/` は C0/C1 **100%**（PRでは変更ファイルのみブロッキング、
  main への push でベースライン全体をブロッキング検証。Codecov は使用せず自前スクリプトで計測。
  詳細は [`.claude/docs/testing-conventions.md`](../.claude/docs/testing-conventions.md) §7.5）
- `test/mock/`, `test/common/` は対象外（透明性のため計測のみ）

### ミューテーションテスト（packages/{core,admin,batch,api}, 週次・非ブロッキング）

C0/C1カバレッジ100%は「そのコードが実行されたか」しか保証せず、「アサーションが実際に
振る舞いを検証しているか」までは保証しない。[Stryker Mutator](https://stryker-mutator.io/)
を使ったミューテーションテストで、ソースコードへ小さな変異（比較演算子の反転・定数変更等）
を注入し、既存テストがその変異を検知して落ちるか（kill できるか）を計測することで、
アサーションの実効性を可視化する。

- **対象**: `packages/core`・`packages/admin`・`packages/batch`・`packages/api`。
  `packages/front` は Flutter/Dart のため Stryker（JS/TS向け）の対象外、`packages/db` は
  マイグレーション専用で `src` が無いため対象外。`packages/api/src/openapi/` は
  手書きの静的OpenAPI仕様（振る舞いを持たないドキュメントデータ）のため対象外。
- **実行方法**: `bun test` を直接サポートするミューテーションツールが無いため、Stryker の
  command runner（任意のテストコマンドを実行し終了コードで判定する汎用ランナー）を使う
  （設定はパッケージごとに `stryker.<pkg>.config.json`、ローカル実行は
  `bun run mutation:<pkg>`）。1ミュータントごとに対象パッケージの単体テストスイート
  全体を実行し直すため実行コストが高く、PRごとには実行しない
  （sIT/UATと同じ理由。[`.github/workflows/mutation-testing.yml`](../.github/workflows/mutation-testing.yml)
  がパッケージごとに並列ジョブとして週次実行し、HTMLレポートをArtifactとしてアップロードする）。
  各configの `ignorePatterns` は壊れたシンボリックリンク（private submodule由来）のみを除外し、
  兄弟パッケージや `tests/` は除外しない（`packages/api` が `packages/db/migrations` と
  `tests/shared` に実際に依存しているため）。
  `packages/api` のみミュータント数が桁違いに多く（openapi除外後も約4,000弱）単一ジョブでは
  完走に数時間かかるため、`mutation-api` ジョブは `src` サブディレクトリ単位（controller・
  usecase・repository（3分割）・gateway・utility・di+middleware+db・router等、計10レグ）の
  matrix並列実行に分割している。他パッケージ同様1レグあたり20〜90分程度に収まる。
- **非ブロッキング**: `thresholds.break` は `null` に設定しており、スコアの高低に
  関わらずジョブは常に成功する。まずは結果を可視化して傾向を把握することを優先し、
  PRのブロッキング化（CIゲート）は別途判断する。
- **失敗時の可視化**: Stryker自体のクラッシュ・タイムアウト等でジョブが失敗した場合は、
  `report-mutation-failure` ジョブがパッケージ単位でGitHub Issueを自動作成・自動Closeする
  （`scheduled-tests.yml` の `report-test-failures` と同じ作法）。`mutation-api` は
  matrix jobのため`needs.mutation-api.result`はレグ横断の集約結果になるが、失敗時は
  各shardのログartifactを走査し、エラーが見つかったshard名をIssue本文に併記して
  原因箇所を特定しやすくしている。

---

## 9. セキュリティポリシー

### サポートバージョン

| バージョン | サポート  |
| ---------- | --------- |
| 0.1.x      | ✅ 対応   |
| < 0.1      | ❌ 非対応 |

### 脆弱性報告

1. **GitHub Security Advisory**: https://github.com/taichi6930/race-schedule/security/advisories/new
2. または Issues でご連絡ください

**報告内容に含める情報:**

- 脆弱性の説明
- 影響を受けるバージョン
- 再現手順

**対応プロセス:** 報告受付後 48時間以内に確認、7日以内に初期評価。

### ベストプラクティス

- 定期的に依存パッケージを更新する
- 環境変数（APIキー・認証情報等）を絶対にコミットしない
- 本番環境では HTTPS を必ず使用する

---

## 10. ロードマップ・タスク

> 最終更新: 2026-07-23（#1・#2・#3・#4・#14 は実装済みを確認したため削除。詳細は各パッケージREADME・`docs/tasks/BACKLOG.md`参照）

### 優先度中（4〜7）

| #  | タイトル                             | 優先度 | 難易度 | 対象              |
| -- | ------------------------------------ | ------ | ------ | ----------------- |
| 5  | エラーレスポンスにトレース ID を追加 | 3      | 4      | 全コントローラー  |
| 6  | batch のエラーハンドリング改善       | 4      | 4      | `packages/batch/` |

### テスト状況（パッケージ別）

具体的なテストファイル件数はここには記載しない（追加のたびに陳腐化するため）。
最新件数を知りたい場合は `find packages/<pkg>/test -name '*.test.ts' | wc -l` を実行するか、
`bun run test:gap` でギャップ状況を確認する。sIT は PR では実行されず `scheduled-tests.yml`
が定期実行する（§8参照）。

| パッケージ  | UT  | Component | sIT | E2E | コメント                                         |
| ----------- | :-: | :-: | :-: | :-: | ------------------------------------------------ |
| `core`      | ✅  | n/a | n/a | n/a | C0/C1 100%                                        |
| `api`       | ✅  | ✅  | ✅  | ❌  | controller/usecase/repository 網羅               |
| `scraping`  | ✅  | ✅  | ✅  | ❌  | C0/C1 100%                                        |
| `batch`     | ✅  | ✅  | n/a | ❌  | sIT対象なし（外部結合テストの対象コードが無い）    |
| `calendar`  | ✅  | ✅  | n/a | ❌  | sIT対象なし                                       |
| `front`     | ✅  | n/a | n/a | △  | Flutter widget test。画面単位のE2E相当として扱う（§8参照） |
| `db`        | n/a | n/a | n/a | n/a | migrations のみ（TS ロジック無し、テスト対象外） |

### 既知の構成上の重複・課題

- `IPlaceUsecase` / `IRaceUsecase` が `api` と `scraping` に二重定義されている
- `RaceController` / `PlaceController` が `api` と `scraping` に同名で存在
- `wrangler.toml` が各 Worker パッケージ（api / batch / calendar / db / scraping）で似たテンプレート構造を重複して持つ（ルートに `wrangler.toml` は存在しない）
- `api` の `development` 環境が `race-schedule-db-test` を参照している（命名不整合）
