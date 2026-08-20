# Database Package

このパッケージはCloudflare D1データベースのマイグレーションを管理します。

> **注記**: 以前は `src/` にテーブルスキーマの型定義・モデルヘルパーを持ち、
> 他パッケージから利用できる想定で公開していましたが、実際に import している
> パッケージが存在しなかった（api/batch/core/scraping のいずれからも参照なし）
> ため削除しました。現在はマイグレーション管理専用のパッケージです。

## 環境構成

- **ローカル環境**: 開発用のローカルD1データベース
- **テスト環境**: ブランチマージ時に自動デプロイ
- **本番環境**: タグ作成時に自動デプロイ

## パッケージ構成

```
packages/db/
├── migrations/                  # D1マイグレーションファイル
├── package.json
└── README.md
```

controller/usecase/repository のような層はこのパッケージには存在しません（マイグレーションSQLのみ）。それらの層は `@race-schedule/api` 側（`gateway/implement/drizzleGateway.ts`）に存在し、api の `IDrizzleGateway`（`drizzle-orm/d1`）が本パッケージが定義したスキーマへ型安全にアクセスします。マイグレーションSQL（本パッケージ）が引き続きスキーマの正であり、api 側の `src/db/schema.ts` はそれに手動で追従させる Drizzle スキーマ定義です（`drizzle-kit` は使用していません）。

## 依存関係の境界（DEP-006 / DEP-030）

本パッケージの `package.json` には `dependencies`/`devDependencies` を意図的に定義していません（マイグレーション管理専用のため、`wrangler` 以外に固有の実行時依存が無いことがその理由です）。ただし以下の暗黙依存があるため、ここに明示します。

- **`wrangler` への暗黙依存**: `migrations:*`/`db:shell:*` の全スクリプトは `wrangler d1 ...` コマンドへ委譲しています。`wrangler` 自体はルートの `package.json`（`devDependencies.wrangler`、`bun.lock` でキャレット無し `4.114.0` に固定）が bun workspace を通じて提供しており、本パッケージ単体でバージョンを宣言していません。
- **最低バージョンの目安**: npm の `peerDependencies` は CLI ツールである `wrangler` には使えない（本パッケージが npm パッケージとして解決されるライブラリではなく、bun workspace 内のスクリプト実行主体であるため）ため、代わりにこの README を依存境界の記録として使う。ルートの `wrangler` を更新する際は、本パッケージが使う `wrangler d1 migrations apply`/`wrangler d1 execute` のCLIフラグ・D1 API 互換性が変わっていないか、`bun run migrations:list:local` 等で疎通確認してから反映すること（DEP-004: miniflare とのバージョン同期チェックの要否も参照）。
- **wrangler 以外の依存が無いことの確認**: マイグレーションSQL自体はプレーンなSQLite方言のDDLのみで、TypeScript実行時ライブラリ（`drizzle-orm`等）には依存しない。型安全なアクセス層（Drizzleスキーマ定義）は `@race-schedule/api` 側の責務であり、本パッケージはスキーマの正（migrations配下のSQL）を保持するのみ。

## テーブル構成（ER図）

```mermaid
erDiagram
    place ||--o{ race : "1つの開催場に複数レース"
    place ||--o| place_grade : "1対1(任意)"
    place ||--o| place_held_day : "1対1(任意)"
    race ||--o| race_stage : "1対1(任意)"
    race ||--o| race_condition : "1対1(任意)"
    race ||--o{ race_player : "1レースに複数の出走選手"
    player ||--o{ race_player : "選手の出走履歴(player_no一致)"
    player ||--o| player_keirin : "1対1(任意、競輪選手のみ)"
    player ||--o| player_autorace : "1対1(任意、オートレース選手のみ)"
    player ||--o| player_watch : "1対1(任意、注目選手登録)"
    player ||--o{ player_history : "1対多(属性変更ログ)"
    push_subscription ||--o{ push_notification_request : "1購読に複数の発火予約"
    user ||--o{ credential : "1人が複数端末のパスキーを持てる"
    user ||--o{ session : "1人が複数端末から同時ログイン"
    user ||--o{ favorite : "お気に入りレース(1対多)"
    user ||--o| invite : "招待の使用(任意、1対1)"
    credential ||--o{ session : "1credentialで複数セッション"

    place {
        string place_id PK
        string race_type
        string date_time
        string location_code
        boolean is_race_list_available
    }
    place_master {
        string race_type PK
        string course_code_type PK
        string place_name PK
    }
    place_grade {
        string place_id PK_FK
        string place_grade
    }
    place_held_day {
        string place_id PK_FK
        int held_times
        int held_day_times
    }
    race {
        string race_id PK
        string place_id FK
        string race_type
        string race_name
        string date_time
        string location_code
        string grade
        int race_number
    }
    race_stage {
        string race_id PK_FK
        string race_stage
    }
    race_condition {
        string race_id PK_FK
        int distance
        string surface_type
    }
    race_player {
        string race_player_id PK
        string race_id FK
        string race_type
        int car_number
        int frame_number
        string player_no
        string player_name
    }
    player {
        string race_type PK
        string player_no PK
        string player_name
        int priority
    }
    player_keirin {
        string player_no PK_FK
        int term
        string branch
    }
    player_autorace {
        string player_no PK_FK
        string branch
    }
    player_watch {
        string race_type PK
        string player_no PK
        int priority
        string label
    }
    player_history {
        int id PK
        string race_type
        string player_no
        string attribute
        string old_value
        string new_value
        datetime observed_at
        string source
    }
    calendar_flag {
        string race_id PK
        string label
    }
    push_subscription {
        string id PK
        string endpoint
        string p256dh
        string auth
    }
    push_notification_request {
        string id PK
        string subscription_id FK
        string race_id
        int fire_at_ms
        string title
        string body
        datetime sent_at
    }
    batch_run_lock {
        int id PK
        string workflow_instance_id
        string started_at
    }
    feature_flag {
        string flag_key PK
        int enabled
    }
    data_quality_warning_log {
        int id PK
        string source
        string message
    }
    ui_layout {
        string layout_key PK
        string config
    }
    release_note {
        int id PK
        string tag_name
        string name
        string body
        string published_at
        int draft
        int prerelease
        string source_repo
    }
    user {
        string id PK
        string nickname
        datetime created_at
    }
    credential {
        string id PK
        string user_id FK
        blob public_key
        int sign_count
        string aaguid
        string user_agent
        string device_label
        datetime last_used_at
        datetime created_at
    }
    invite {
        string token PK
        string memo
        datetime expires_at
        string used_by_user_id FK
        datetime created_at
    }
    session {
        string token PK
        string user_id FK
        string credential_id FK
        datetime expires_at
        datetime created_at
    }
    favorite {
        string user_id PK_FK
        string race_id PK
        datetime created_at
    }
    webauthn_challenge {
        string id PK
        string challenge
        string purpose
        string invite_token
        datetime expires_at
        datetime created_at
    }
```

`race_player` はレースの出走表スナップショットです（`race_player_id` は `race_id` + 車番の合成ID。枠番は複数車で共有され一意にならないため車番で合成する。`race`/`race_stage`/`race_condition` と同様スクレイピングが所有し、再取得のたびに上書き・削除される。`0021_race_player.sqlite.sql`）。

`player_keirin`/`player_autorace`/`player_watch`/`player_history` は選手データの拡張です。`player_keirin` は競輪固有の選手属性（期別・府県、`0022_player_keirin.sqlite.sql`）。`player_autorace` はオートレース固有の選手属性（拠点/LG。出走表HTMLに期別に相当する情報が無いためterm列は持たない、`0031_player_autorace.sqlite.sql`）。`player_watch` はユーザーが登録した注目選手（`calendar_flag` と同じ位置づけでスクレイピング経路からは書き込まない、`0023_player_watch.sqlite.sql`）。`player_history` は選手属性の変更を検知したときだけ追記するログ（追記専用、`0024_player_history.sqlite.sql`）。

`batch_run_lock` はbatch実行（cron/手動の複数起動経路）の排他制御用ロックテーブルです。`id=1` の1行のみを許可し、`workflow_instance_id` が未設定のときだけ空き扱いとします（`0027_batch_run_lock.sqlite.sql`）。

`feature_flag` は機能フラグの本番展開制御テーブルです。行が存在すればその `enabled` 値が最優先で使われ、行が無いキーは各Workerの `wrangler.toml` 環境変数（`FEATURE_XXX_ENABLED`）を既定値として使います（`0029_feature_flag.sqlite.sql`）。

`data_quality_warning_log` はデータ品質警告の蓄積ログです（追記専用）。`PlaceRepository.fetch` 等がマッピング失敗行をスキップする際にベストエフォートで記録し、api Worker の scheduled ハンドラ（既存のCloudflareエラー監視と同じ1時間おきcron）が `source` ごとに直近ウィンドウでCOUNTしてGitHub Issueの作成/追記/Closeに使います（`0032_data_quality_warning_log.sqlite.sql`）。

`ui_layout` はServer-Driven UI（`GET /ui/race-detail` 等）のレイアウト構成（フィールド参照JSON）を保存するテーブルです。`feature_flag` と同じ「行があれば最優先、無ければコード内既定値にフォールバック」という考え方をJSON構成全体に拡張したもので、`config` 列には値そのものではなくフィールド参照のみが入ります（`aidlc-docs/inception/application-design/race-detail-sdui-design.md` 参照、`0033_ui_layout.sqlite.sql`）。

`release_note` は更新履歴（front の What's New 画面）テーブルです。race-schedule（旧統合リポジトリ）のprivate化に伴い、GitHub Releases APIを匿名で直接fetchする既存方式では過去リリース（v1.x）が参照できなくなるため、frontが読む先をこのテーブル（DB経由のAPI）へ切り替えました。`body` にはGitHub Releaseと同じMarkdown本文をそのまま保存します。`tag_name` はrace-schedule/race-scheduler双方で独立採番されており重複しうる（実例: 両方とも分割区切りとして`v2.0.0`を採番）ため、一意性は`(tag_name, source_repo)`の複合indexで担保します（`0038_release_note.sqlite.sql`）。

`calendar_flag` は `race` から独立したテーブルです（スクレイピングによる `race` の再作成が起きても、ユーザーが設定したカレンダー掲載意思を保持するための設計。`0015_calendar_flag.sqlite.sql`）。

`push_subscription`/`push_notification_request` は Web Push 通知（タブを閉じていても発走前通知が届く機能）の購読・発火予約テーブルです（`0016_push.sqlite.sql`）。

### `push_notification_request` のデータ保持ポリシー（SEC-060）

`push_notification_request`（購読 × レースの発火予約）は、「どの購読がどのレースに関心を
持つか」という行動プロファイルが蓄積されうるテーブルです。これを無期限に蓄積しないよう、
以下の保持ポリシーで自動削除されます。

- **保持期間**: 発火予定時刻（`fire_at_ms`）から **24時間**
  （`packages/api/src/usecase/implement/pushUsecase.ts` の `OLD_REQUEST_RETENTION_MS`
  = `24 * 60 * 60 * 1000`）
- **削除トリガー**: 通知配信バッチ `PushUsecase.dispatchDue`（毎分cron実行が前提）が、
  対象予約の送信処理を終えるたびに
  `requestRepository.purgeOld(nowMs - OLD_REQUEST_RETENTION_MS)` を呼び出し、
  `fire_at_ms` がその閾値より過去の予約を送信済み・未送信を問わず削除します
  （`pushUsecase.ts` の `dispatchDue`）。
- **削除対象**: `fire_at_ms` が閾値より古い予約はすべて対象（`sent_at` の有無は問わない）。
  実装上、対象0件の時間帯でも毎分このパージは無条件に実行されます
  （`fire_at_ms` 単一列インデックスを使う軽量なDELETEのため、間引きは見送り済み。
  `docs/tasks/BACKLOG.md` PERF-180参照）。
- **影響範囲**: 購読が有効な間も、24時間より前の関心履歴（どのレースの通知を予約したか）は
  D1上に残らないため、行動プロファイルの蓄積は直近24時間分に限定されます。なお
  `push_subscription`（購読自体）は本ポリシーの対象外で、ユーザーが明示的に通知をオフに
  するまで残ります。

## ローカル環境のセットアップ

```bash
cd packages/db
./setup-local.sh
```

または手動で：

```bash
# マイグレーション適用
bun run migrations:apply:local

# マイグレーション一覧確認
bun run migrations:list:local

# DBシェルにアクセス
bun run db:shell:local
```

> 補足: これらのローカルコマンドは `packages/api/wrangler.toml` を参照して実行されます。API の開発サーバーと同じ D1 ストレージを更新するため、`wrangler dev` 実行時にテーブルが存在しないという問題を避けられます。

## マイグレーション

マイグレーションファイルは `migrations/` ディレクトリに配置されています。

### マイグレーションの適用

```bash
# ローカル環境
bun run migrations:apply:local

# テスト環境
bun run migrations:apply:test

# 本番環境
bun run migrations:apply:production
```

### 破壊的マイグレーション追加時の運用ルール（OPS-02）

D1（`wrangler d1 migrations`）は前方向の適用のみをサポートし、Railsのような
`down`マイグレーション（自動的な巻き戻し）の仕組みを持ちません。`DELETE`/`UPDATE`
を伴う破壊的マイグレーション（例: `0009_delete_invalid_nar_data.sql`、
`0010_convert_datetime_to_jst.sql`、`0011_normalize_datetime_format.sql`、
`0012_normalize_nar_location_code.sql`）を追加・テスト環境/本番環境へ適用する際は、
以下を必須の運用手順とする。

1. **適用前に対象環境のバックアップを取得する**。
   `wrangler d1 export <データベース名> --remote --env <test|production> --output backup-YYYYMMDD-<マイグレーション番号>.sql`
   （`wrangler`はルートの`package.json`が提供、[依存関係の境界](#依存関係の境界dep-006--dep-030)参照）。
   バックアップファイルはリポジトリにコミットせず、実行者が一時的に手元へ保存する
   （本番データを含むため。取り扱いは`SEC-057`/`SEC-060`の指摘とも整合させる）。
2. **マイグレーションファイルの先頭コメントに、そのマイグレーションが破壊的かどうかと
   巻き戻し方針を`-- ROLLBACK:`コメントブロックとして明記する**（0009〜0012参照）。
    - **変換前の値から逆変換できる場合のみ**、戻すためのSQLを明記する。
    - **DELETEでデータ自体が失われる場合、または変換前後で区別がつかず逆変換できない
      場合**（0009〜0012はいずれもこちらに該当）: 巻き戻しはバックアップからの
      リストアのみで可能である旨を明記する。
3. **リストア手順**: `wrangler d1 execute <データベース名> --remote --env <test|production> --file backup-YYYYMMDD-<マイグレーション番号>.sql`
   でバックアップを再投入する。D1はマイグレーション適用状態を`d1_migrations`
   テーブルで管理しているため、リストア後は`bun run migrations:list:<env>`で
   適用済みマイグレーション一覧の整合性も確認すること。
4. ローカル環境（`--local`）は使い捨て前提のため、上記の適用前バックアップは
   **テスト環境・本番環境への適用時のみ必須**とする。

> 関連: 本番マイグレーション適用の事前バックアップ・dry-run手順全体の整備状況は
> `TEST_PLAN.md`のロールバック安全性項目（`test/rollback.test.ts`、未実装）で
> 別途追跡する（OPS-01）。本節はそれとは独立に、破壊的マイグレーションを
> 追加する開発者が最低限守るべき運用手順を明文化したもの。

## デプロイフロー

### テスト環境

- `main`ブランチへのマージ時
- `packages/db/`配下に変更がある場合のみ実行

### 本番環境

- GitHubでタグが作成された時
- 前回のタグと比較して`packages/db/`配下に変更がある場合のみ実行
