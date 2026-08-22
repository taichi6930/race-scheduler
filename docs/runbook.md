# 障害対応runbook

> **これは何か**: 主要な障害パターンごとに「まず何を確認し、どう切り戻すか」を最小限にまとめた
> ものです（QRUN-06）。運用者が1人のため、その1人が忘れている・手が離せない状況でも
> このファイルだけで最初の一手が分かることを目的にしています。監視Issue（GitHub Issue）は
> 「何が起きたか」を伝えますが、「次に何をするか」はコードとドキュメントに分散していたため、
> ここに集約します。実装が変わったら本ファイルも更新してください。

## 監視の仕組み（前提）

api Worker の scheduled ハンドラが以下5系統の異常を検知すると、固定タイトルのGitHub Issueを
作成し、復旧を検知すると自動的にCloseします（`packages/api/src/utility/*Notifier.ts`）。
Issueのタイトルで検索すると、どの系統の異常かすぐに分かります。

| Issueタイトル（先頭部分） | 検知対象 | 実装 |
| --- | --- | --- |
| `[Health Check] 本番データが更新されていない疑い` | 当日のレース件数が全種別合計0件 | `dataFreshnessNotifier.ts` |
| `[Cloudflare] <スクリプト名> でエラーを検知` | Worker単位のエラー数（GraphQL Analytics） | `errorMonitorNotifier.ts` |
| `[Uptime] <対象> の /health 疎通に失敗` | 各Workerの `/health` 疎通 | `uptimeCheckNotifier.ts` |
| `[データ品質] <source> で不正なデータを検知` | `data_quality_warning_log` の集計 | `dataQualityWarningNotifier.ts` |
| `[Batch] Workflow実行で失敗が発生` | batch Workflowのstep失敗 | `notifyBatchWorkflowFailure.ts`（QRUN-01により成功時は自動Close） |

## パターン1: データが更新されない

**症状**: `[Health Check] 本番データが更新されていない疑い` Issueが作成される。または
利用者からレース情報が古いという報告がある。

1. **`[Batch] Workflow実行で失敗が発生` Issueが同時期に無いか確認する。** あれば、Issue本文の
   Cloudflare Workers Logsへのリンクからインスタンス IDでログを検索し、原因（スクレイピング先の
   変更・API障害等）を特定する。
2. Issueも失敗ログも無い場合は、**batch実行そのものが起動していない可能性**を疑う。
   `packages/batch/wrangler.toml` の `[triggers] crons` が本来の起動スケジュール通りか確認する。
3. **batch実行がロックで止まっている可能性を疑う。** `POST /internal/batch-lock/acquire` は
   既に他インスタンスが保持中だと409を返す設計で、ロックは取得から**30分で自動的にstale扱い**
   になり次の実行が奪取できる（`STALE_LOCK_MS`、`packages/api/src/usecase/implement/batchLockUsecase.ts`）。
   30分以上経っても直らない場合は `POST /internal/batch-lock/release`（`X-Service-Auth-Token` 必須）
   で手動解放できる。
4. 個別の日付・開催場だけ欠けている場合は、admin の **バックフィル画面**（`/backfill`）から
   対象期間を指定して再実行できる。これはR2キャッシュ済みHTMLからの再Upsert専用で、生
   スクレイピングは行わない（キャッシュに無い分は `notCachedKeys`/`notCachedPlaceIds` として
   結果に表示される。QADM-11で折りたたみ表示済み）。生スクレイピングからの再取得が必要な
   場合は、対象のbatch Workflowを手動で再起動する。

## パターン2: Workerが5xxを返す

**症状**: `[Cloudflare] <スクリプト名> でエラーを検知` または `[Uptime] <対象> の /health 疎通に
失敗` Issueが作成される。あるいはfrontから「取得に失敗しました」の報告が継続する。

1. Issue本文が示すスクリプト名（`race-schedule-api-prod` 等）から対象Workerを特定し、
   Cloudflare DashboardのWorkers Logsで直近のエラーを確認する。
2. **直前のデプロイが原因の可能性を疑う。** `race-scheduler` / `race-schedule` 双方のリポジトリで
   直近のマージ・デプロイ履歴を確認し、必要なら1つ前のバージョンへロールバックする
   （デプロイ手順は `packages/README.md` のデプロイフロー参照）。
3. **機能フラグでの切り戻しが使える範囲は限定的**（2026-08-22時点、`FEATURE_FLAG_DEFINITIONS`
   に定義されているのは起動時お知らせバナー（`announcement_banner`）のみ）。障害の原因が
   このフラグに紐づく機能で無い限り、フラグ切り戻しでは解決しない。
4. D1（データベース）の疎通自体が疑わしい場合は `GET /health` のレスポンス（D1疎通確認込み）を
   確認する。

## パターン3: Google Calendarに同期されない

**症状**: 利用者からレースがGoogle Calendarに反映されないという報告がある。カレンダー同期の
batchログ（`=== Calendar Batch: ... ===`）にエラーが出ている。

1. `packages/batch/src/batch/calendar.ts` は `CALENDAR_API_URL`（環境変数）が指す**外部のcalendar
   Worker**（`POST /sync`）を呼ぶだけの薄いクライアントである。同期失敗の実処理（Google Calendar
   APIとの通信・認証）はcalendar Worker側にあるため、`CALENDAR_API_URL` が指す先のログを確認する。
2. `CALENDAR_API_URL` 自体が未設定・誤設定だと `getCalendarApiUrl()` が例外を投げ、当該batch
   Workflow stepが失敗する（パターン1の `[Batch] Workflow実行で失敗が発生` Issueとして検知される）。
   まず環境変数の設定を疑う。
3. カレンダー登録は `race`/`race_condition` テーブルの「カレンダー登録フラグ」が立っている
   レースのみが対象。個別レースが登録されない場合は、そのレースのフラグ設定を確認する
   （`POST/DELETE /calendar/flag`、`X-Service-Auth-Token` 必須の内部APIのため front からは
   直接呼べない）。

## 共通の一次切り分け

- どのパターンでも、まず対象Workerの `GET /health` を叩き、D1疎通・稼働状況を確認する。
- GitHub Issue検索（`is:open label:...` ではなくタイトル文字列で検索、上表参照）で、既に自動検知
  されているかをまず確認してから手動調査に入ると二度手間を避けられる。
