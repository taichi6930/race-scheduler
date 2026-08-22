# scripts/ 一覧

`scripts/` 配下には多数のTypeScriptスクリプトがあり、目次・一覧が無く似た既存
スクリプトを探すのに時間がかかっていた（QDEV-13）。新しいチェック・生成処理を
追加する前に、まずここで既存スクリプトが使えないか確認すること。（本ファイル自身が
経年で古い本数表記のままドリフトしていたため、2026-08-22にスクリプト固定の本数表記を
やめ、本文の一覧を最新化した）

各スクリプトの実行方法は基本的に `bun run <npm script>`（`package.json` の
`scripts` に対応するエイリアスがある場合）または `bun scripts/<ファイル名>.ts`
（直接実行）。「CI」列は `.github/workflows/*.yml` から呼び出されているスクリプト
であることを示す（PRごとに自動実行される）。

## 1. `check:*` — CI検証スクリプト（読み取り専用、非ゼロ終了で異常を知らせる）

| スクリプト | npm script | CI | 概要 |
| --- | --- | --- | --- |
| `check-admin-color-drift.ts` | `check:admin-color-drift` | ✅ | admin `adminPageChrome.ts` の `FRONT_COLORS`/`FRONT_COLORS_DARK` と front `tokens.dart` の配色値のドリフトを検証する（QADM-10） |
| `check-app-name-sync.ts` | `check:app-name-sync` | ✅ | アプリ名・説明文が `manifest.json`/`index.html`/`app.dart` で一致しているか検証する（QSYNC-10） |
| `check-audit-allowlist.ts` | - | ✅ | `docs/security/audit-allowlist.json`（対応不要と判断した脆弱性の一覧）を検証し、`bun audit --ignore=` フラグ列を組み立てる |
| `check-coverage-baseline.ts` | `check:coverage-baseline` | ✅ | `test:gap:json` の出力から、非front srcのC0/C1カバレッジがベースライン（100%）を維持しているか検証する |
| `check-cron-sync.ts` | `check:cron-sync` | ✅ | `packages/api/wrangler.toml` の cron 定義と `src/scheduled.ts` のcron定数の一致を検証する（QSYNC-01） |
| `check-db-er-diagram-drift.ts` | `check:db-er-diagram-drift` | ✅ | `packages/db/migrations/*.sql`（正）と `packages/db/README.md` のER図のドリフトを検証する |
| `check-deploy-working-dirs.ts` | `check:deploy-working-dirs` | ✅ | `deploy-*-reusable.yml` の `working-directory` に `wrangler.toml` が実在するか検証する |
| `check-design-layers.ts` | `check:design-layers` | ✅ | front（Flutter）のAtomic Designレイヤー規約（import方向・角丸+塗りの直書き禁止）を検証する |
| `check-doc-duplication.ts` | - | - | `.claude/docs/` と `.claude/skills/` 間で3行以上一致する重複ブロックを検出する |
| `check-gate-commands.ts` | `check:gate-commands` | ✅ | `loop-engineering` ドキュメントが参照する `bun run <script>` が `package.json` に実在するか検査する |
| `check-generated-dirs-excluded.ts` | `check:generated-dirs` | - | 生成物ディレクトリ（`coverage/` 等）が `.gitignore` で除外されているか検証する |
| `check-grade-master-sync.ts` | `check:grade-master-sync` | ✅ | core `GradeMaster`（`gradeName`×`raceType`）と front `grade_tier.dart` の静的テーブルの網羅性を検証する（QSYNC-02） |
| `check-large-markdown.ts` | - | ✅ | PRで変更された `.md` ファイルのうち20KBを超えるものを警告する |
| `check-licenses.ts` | `check:licenses` | ✅ | 依存パッケージのライセンス（GPL系混入の有無等）を機械チェックする |
| `check-miniflare-wrangler-sync.ts` | `check:miniflare-sync` | - | 固定した `miniflare` のバージョンが `wrangler` の要求と一致しているか検証する |
| `check-node-version-sync.ts` | `check:node-version-sync` | ✅ | Node.jsメジャーバージョンの`.nvmrc`/`package.json`（engines.node・@types/node）三重管理の一致を検証する |
| `check-package-readme-sync.ts` | - | - | `packages/README.md` の各パッケージドキュメントへのリンク切れを検証する |
| `check-patch-coverage.ts` | - | ✅ | PRで変更されたファイルとカバレッジgapファイルの積集合を取り、patchカバレッジ100%を強制する |
| `check-pkg-label-sync.ts` | `check:pkg-label-sync` | - | `pkg:*` ラベル対象パッケージ一覧が `pull_request.yml` と `packageLabels.ts` で一致しているか検証する |
| `check-pubspec-lockfile-drift.ts` | - | - | `pubspec.yaml` 手編集後の `flutter pub get` 忘れ（lockfile未反映）を検知する |
| `check-push-sw-scope-sync.ts` | `check:push-sw-scope-sync` | ✅ | Web PushのService Workerスクリプト名・スコープが静的JSとDartコード間で一致しているか検証する（QSYNC-05） |
| `check-race-type-sync.ts` | `check:race-type-sync` | ✅ | `RaceType` 6値の集合がcoreとfrontで一致しているか検証する（QSYNC-03） |
| `check-secret-wiring.ts` | - | ✅ | `cloudFlareEnv.ts` のstring型フィールドがコード内で実際に読まれているかを検証する |
| `check-workflow-hygiene.ts` | `check:workflow-hygiene` | ✅ | `.github/workflows/*.yml` を静的解析し、ジョブ数・timeout-minutes・キャッシュ有無を可視化する |
| `check-wrangler-config.ts` | `check:wrangler-config` | ✅ | `wrangler.toml` の設定警告（named environmentへの非継承等）と、git追跡漏れを検知する |
| `find-stale-aidlc-docs.ts` | `check:stale-aidlc-docs` | - | `aidlc-docs/` が参照するコードパスの参照切れを検出する |
| `verify-scheduled-workflows.ts` | - | - | `.github/workflows/*.yml` の `schedule:`（cron）トリガーの構文・重複を検証する |

## 2. `release/` — リリース自動化（`deploy.yml` から呼び出される）

| スクリプト | CI | 概要 |
| --- | --- | --- |
| `autoRelease.ts` | ✅ | post-merge-verify成功後に呼ばれる、patch/minor限定の自動タグ作成・自動リリーススクリプト |
| `backfillReleaseNotes.ts` | - | 既存GitHub Releasesを `release_note` テーブルへ投入する一度きりのバックフィル用 |
| `commitPrLookup.ts` | - | コミット履歴からPR番号を特定する共通ヘルパー（`generateReleaseSummary.ts`/`autoRelease.ts`が使用） |
| `detectNearMissHeadings.ts` | ✅ | PR本文の更新履歴見出しが規約（`## `）とレベル違いの「ニアミス」になっていないか検出する |
| `generateReleaseSummary.ts` | ✅ | `autoRelease.ts` から呼ばれる、リリースノート本文の生成スクリプト（AI要約は使わない） |
| `packageLabels.ts` | ✅ | PRの `pkg:*` ラベル定義（`PACKAGE_LAYERS`）。リリースノートの `[api]` 等のプレフィックス付与に使用 |
| `releaseNoteCategories.ts` | ✅ | リリースノートのカテゴリ見出し規約（front側のパース処理と共有） |

## 3. 生成・レポート系（`build-*` / `generate-*` / `report-*`）

| スクリプト | npm script | CI | 概要 |
| --- | --- | --- | --- |
| `build-allure-environment.ts` | - | - | Allure ReportのEnvironmentウィジェット用 `environment.properties` を生成する |
| `build-allure-executor.ts` | (`allure:generate`内) | ✅ | Allure ReportのHistoryタブ用 `executor.json`（ビルド名・URL・実行時刻）を生成する |
| `build-allure-results.ts` | `allure:build-results` | ✅ | JUnit XML + イベントJSONLから、Allureネイティブ結果ディレクトリを組み立てる |
| `build-ci-duration-comment.ts` | - | ✅ | PRのジョブ別所要時間を直近平均と比較したPRコメント本文を組み立てる |
| `build-gap-comment.ts` | - | ✅ | `test-gap-analysis.ts --json` の出力から `coverage-pr.yml` のPRコメント本文を組み立てる |
| `build-mutation-diff-comment.ts` | - | ✅ | PR差分スコープで実行したStrykerのJSONレポートから `mutation-diff-report.yml` のPRコメント本文を組み立てる |
| `filter-coverage-report.ts` | (`test`内) | ✅ | `bun test --coverage` 実行後、カバレッジ除外サマリーを表示する |
| `flatten-junit-xml.ts` | - | ✅ | ネストしたJUnit XMLの `<testsuite>` をtest-reporter用にフラット化する |
| `generate-claude-md-toc.ts` | - | - | `CLAUDE.md`/`.claude/docs/` の見出しから目次を生成する |
| `generate-layer-dependency-graph.ts` | - | - | controller→usecase→repository→gatewayのレイヤー依存を可視化するグラフを生成する |
| `generate-sbom.ts` | `sbom:generate` | ✅ | 依存パッケージの名前・バージョン・ライセンス一覧（簡易SBOM）をJSON出力する |
| `generate-symbol-map.ts` | - | - | `core/src` の各層バレルが re-export する公開シンボル一覧をJSON+md出力する |
| `generate-test-report.ts` | `test:report`, `test:report:full` | ✅ | UT/コンポーネント/sIT/E2E/UAT・frontの「何がテストされているか」レポートを生成する |
| `lint-summary.ts` | `lint:summary` | - | `lint:check` の生の全出力ではなく件数サマリ＋先頭20件だけを表示する |
| `measure-context-cost.ts` | `tok:measure`, `tok:measure:json`, `tok:measure:save` | - | 毎セッション必ずロードされる静的コンテキストのバイト数・概算トークン数を計測する |
| `mutation-diff-targets.ts` | - | ✅ | PRの変更ファイル一覧から、各パッケージの `stryker.<pkg>.config.json` の `mutate` スコープに実際に入るファイルだけを抽出する |
| `report-ci-duration.ts` | `ci:duration-report` | - | `pull_request.yml` の直近実行のジョブ別所要時間（平均・最大）を集計する |
| `report-slow-tests.ts` | `test:slow` | - | ファイル別テスト実行時間の上位N件をレポートする |
| `report-test-summary.ts` | - | ✅ | `generate-test-report.ts build` が生成した `report.json` をMarkdown表に変換する |
| `report-todo-fixme.ts` | - | - | `packages/*`・`scripts/` 配下のTODO/FIXMEコメントを棚卸しする |
| `run-bun-layer-with-inspector.ts` | - | ✅ | Inspector Protocol付きで `bun test` を実行し、Allure用イベントJSONLを生成する |
| `spec-coverage.ts` | `spec:coverage`, `spec:coverage:json` | ✅ | `docs/specs/*.md` と テストの `@spec <ID>` タグを突合し仕様カバレッジを集計する |
| `strip-html-comments.ts` | - | ✅ | production向けビルド成果物のHTMLから開発者向けコメントを除去する |
| `test-changed.ts` | `test:changed` | - | 変更したファイルに関連するテストだけを実行する |
| `test-gap-analysis.ts` | `test:gap`, `test:gap:json` | ✅ | 各パッケージのC0/C1カバレッジを集計し、100%未満のファイルをgapとして報告する |
| `type-check-summary.ts` | `type-check:summary` | - | `type-check` の生の全出力ではなくファイル別エラー件数サマリを表示する |

## 4. `lib/` — 共通ヘルパー（直接実行しない）

| スクリプト | 概要 |
| --- | --- |
| `allureFromEvents.ts` | Inspector Protocolのイベント列からAllureネイティブ結果向けのテストケース情報を組み立てる |
| `bunInspectorClient.ts` | bunのInspector Protocolに接続し、テスト実行イベントを収集する |
| `ciDuration.ts` | CIジョブ所要時間の取得・集計に関する共通ヘルパー |
| `knownCoverageArtifacts.ts` | bunのカバレッジ計測が構造的に100%へ到達できない既知ファイルの許容リスト |
| `walkDir.ts` | ディレクトリ再帰走査の共通ヘルパー |

## 5. その他（開発補助・一度きりの用途）

| スクリプト | npm script | 概要 |
| --- | --- | --- |
| `audit-skill-usage.ts` | - | `loop-engineering` recipe（Worker skill）の実利用状況を集計する |
| `confirm-production-access.ts` | - | 本番リソースへ直接アクセスするコマンドの実行直前に確認ゲートとして挟む |

## 更新ルール

新しいスクリプトを追加したら、このファイルの該当する節へ1行追加すること
（QDEV-13）。機械的な同期チェックは設けていない（`check:pkg-label-sync.ts` 等と異なり、
説明文の要約は自動生成できないため）。
