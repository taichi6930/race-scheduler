# モジュール境界の問題点リスト

> 「モジュールの分け方が良くない」箇所を、ファイルパス・理由・影響付きで列挙する。
> 重要度: 🔴 高（構造的負債）/ 🟡 中（一貫性・保守性）/ 🟢 低（命名・軽微）
>
> **本書は 2026-07-26 時点のスナップショット**。「✅ 解消済み」項目の「場所（解消前）」
> 欄は意図的に過去のパスを記録しているため、参照先ファイルが現存しなくて正常
> （`bun run check:stale-aidlc-docs` の検出対象になるが対応不要）。未解消項目のパスは
> 以後のリファクタで変わる場合がある。

---

## ISSUE-01 ✅ 解消済み `db` パッケージのコード資産がランタイム未使用（デッドコード / 型の二重管理）

- **場所（解消前）**: `packages/db/src/types/schemas.ts`, `packages/db/src/models/*.model.ts`（全 10 ファイル中 migrations 以外）
- **事実（解消前）**: `@race-schedule/db` は自身の barrel 以外どこからも import されない。api は `packages/api/src/gateway/implement/dbGateway.ts` と `repository/implement/placeMapper.ts` / `raceMapper.ts` / `fetchSqlBuilder.ts` で D1 に独自アクセスしており、db の Row 型/models を使わない。
- **理由**: 「DB スキーマの単一の正」を担う想定で作られた db パッケージが、api の自前実装に置き換えられ、実装だけ残った。
- **影響（解消前）**: マイグレーションで列変更した際、型（`PlaceRow` 等）で守られず api mapper の修正漏れをコンパイラが検出できない。テスト（`db/test/unittest/models`）も未使用コードを検証している。db の実価値は `migrations/*.sql` のみ。
- **対応（T-01）**: `src/types/schemas.ts` / `src/models/*.model.ts` と対応テストを削除し、db パッケージを migrations 専用に純化。api のクエリは複数テーブル JOIN の非正規化結果で db の単一テーブル Row 型と構造的に一致せず、「型で接続する」より「未使用コードを削除する」方が実利が大きいと判断（詳細は `reorganization-tasks.md` T-01 参照）。

---

## ISSUE-02 🔴→🟡 部分解消 `core` の grab-bag 化（何でも屋）

- **場所（当初）**: `packages/core/src/`（123 ファイル）。特に `utilities/`（30 ファイル超）
- **事実（当初）**: 純ドメイン（`domain/`）、DTO/entity、HTTP 境界（`http/` + `controller/`）、検証（`schemas/` + `filters/` + `types/` の Zod）、環境依存 utility（`envStore`, `cloudFlareEnv`, `diInitializer`）が単一パッケージに同居。
- **理由**: 「共通なら core」という運用で、性質の異なるものが吸い込まれた。
- **影響**: 変更の影響範囲が読みにくく、テスト/型チェックの粒度が粗い。フロント/バックエンド非依存であるべき純ドメインが、Cloudflare 環境依存コード（`cloudFlareEnv.ts`）と同居し、再利用境界が曖昧。
- **対応（T-04, T-11）**: `controller/` を `http/` に統合（T-04）、環境依存 utility 5 ファイルを `utilities/platform/` へディレクトリレベルで分離（T-11）し Phase 2 の切り出し線を可視化した。**ただしパッケージ物理分割（Phase 2 = Option B）は未実施**。純ドメインと環境依存コードは依然として同一パッケージ内に同居しており、根本的な「grab-bag」自体の解消には至っていない。

---

## ISSUE-03 ✅ 解消済み 値オブジェクトの配置が `types/` と `domain/model/valueObject/` に二重化

- **場所（解消前）**:
    - `packages/core/src/types/`（raceType, raceName, raceDistance, raceNumber, raceDateTime, surfaceType, playerNumber, positionNumber …）
    - `packages/core/src/domain/model/valueObject/`（course, gradeType, locationCode, placeId, raceCourse, raceId, raceStage）
- **事実（解消前）**: どちらもブランド付き値オブジェクト（Zod スキーマ内包）だが、2 ディレクトリに分散。
- **理由**: 歴史的経緯で `types/` に先に置かれ、後から DDD 的に `domain/model/valueObject/` が新設された可能性。
- **影響（解消前）**: 新規 VO の置き場が不明瞭。同種概念が別ディレクトリに散り、発見性が低い。
- **対応（T-03）**: `types/` 配下の 12 個の VO ファイルを `domain/model/valueObject/` へ統合。`types/` には DTO/Error（`UpsertApiResponse`, `ValidationError`）のみ残した。なお `raceStage` の「三重化の疑い」は誤検知と判明: `utilities/raceStage.ts` は VO ではなく「DB から `RaceGradeAndStageList` 相当のデータを取得しフォールバックする関数」であり、`domain/model/valueObject/raceStage.ts`（純粋な VO スキーマ）とは別の関心事のため、そのまま維持した。

---

## ISSUE-04 ✅ 解消済み HTTP 境界ヘルパーが `core/http/` と `core/controller/` に重複

- **場所（解消前）**: `packages/core/src/http/`（cacheControl, cors, errorResponse, queryParamParser）と `packages/core/src/controller/`（parse, parseBodyOrBadRequest, parseOrBadRequest, response）
- **事実（解消前）**: 両者とも「HTTP リクエスト parse / レスポンス生成」の純ロジック。
- **理由**: `controller` の名で HTTP 入出力ヘルパーを切り出したが、後に `http/` が追加され責務が被った。
- **影響（解消前）**: 共有ライブラリに「controller 層」という語があること自体が誤解を招く（controller は本来 api/scraping の層）。どちらに書くべきか曖昧。
- **対応（T-04）**: `controller/` の 4 ファイルを `http/` へ移動し `controller/` を削除。公開シンボル名は変更していないため他パッケージへの影響なし。

---

## ISSUE-05 ✅ 誤検知として解消 検証（validation）ロジックの三系統分散

- **場所（当初）**: `packages/core/src/schemas/`, `packages/core/src/filters/`, および `domain/model/valueObject/` 内の Zod
- **事実（当初の想定）**: フィルタ検証・upsert 検証・値検証が 3〜4 箇所に分散していると想定した。
- **調査結果（T-05）**: `filters/` の中身（`CalendarFilterParams`, `CalendarUpsertResult`）は Zod を一切使わない純粋な DTO 型定義であり、`schemas/` の実際の Zod 検証（フィルタパラメータ・upsert ペイロード）とは無関係だった。「三系統分散」は誤検知。実際の検証ロジックは `schemas/`（リクエスト検証）と `domain/model/valueObject/`（VO 単体検証）の 2 系統のみで、これは目的が異なる正当な分離（前者は複数フィールドの組み合わせ検証、後者は単一値のブランド型検証）であり統合対象ではない。
- **対応**: `filters/` を実態に合わせて `dto/` にリネームし、命名の誤解のみ解消した。

---

## ISSUE-06 🟡→✅ 部分解消 router / エラーハンドラ / キャッシュ配線の重複（api ↔ batch ↔ scraping）

- **場所（解消前）**: `packages/api/src/router.ts`（`onError` L364, `createCacheControlMiddleware` L377）、`packages/api/src/utility/errorHandler.ts`, `utility/cacheControl.ts`、`packages/batch/src/router.ts`（`internalErrorResponseBody` L297）、`packages/scraping/src/router.ts`
- **事実（解消前）**: 各 Worker が Hono ルータのエラーハンドリング/CORS/キャッシュを個別に配線。cacheControl は core 純関数 + api 側 Hono ラッパという良い分離があるが、batch/scraping はそのラッパを再利用していない。
- **影響（解消前）**: エラー整形やキャッシュ方針の変更が 3 箇所に波及。専用 skill（`consolidate-router`）が用意されるほどの既知重複。
- **対応（T-06）**: エラーログ＋応答ボディ組み立てを core の `logInternalError()` に集約し、api/batch/scraping 全てから呼び出すよう統一（batch の未サニタイズログ出力、scraping の未ログ出力という副次的な安全性ギャップも解消）。**CORS 設定の重複は範囲外のまま**: api は per-request キャッシュ最適化のため独自の `resolveAllowedOrigins`/`DEFAULT_ALLOWED_ORIGINS` を持ち、batch/scraping は core の `getAllowedOrigins()` を直接使う設計差異があり、セキュリティに関わる領域のため安易な統合はリスクが高いと判断し見送った。cacheControl（api のみ使用、batch/scraping は未使用）の統合も未着手。

---

## ISSUE-07 ✅ 誤検知として解消 place/race の変換ロジックが 3 パッケージに分散

- **場所**: `packages/api/src/repository/implement/placeMapper.ts` / `raceMapper.ts`、`packages/scraping/src/utility/mapPlaceEntityToDto.ts` / `mapRaceHtmlEntityToDto.ts`、`packages/batch/src/util/batchEntityHelpers.ts`
- **事実（当初の想定）**: 同じ place/race ドメインの DTO ↔ Entity ↔ Row 変換が 3 パッケージに散っており、重複ロジックと想定した。
- **調査結果（T-07）**: 3 つはそれぞれ型・方向・検証責務が異なる別処理（DB Row→Entity の Zod 検証／Entity→DTO のフィールド射影／DTO→Entity の未検証入力チェック）で、統合すべき重複ロジックではなかった。実際に共有すべきドメインロジック（開催場名⇔コード解決）は既に `core` の `findPlaceCodeByName`/`findPlaceNameByCode` として存在し、3 パッケージ全てが利用済み。追加の抽出は不要と判断した。

---

## ISSUE-08 🟡 `batch` の役割名と実態の乖離（HTTP オーケストレータ）

- **場所**: `packages/batch/src/`（batch/, client/, util/）、`packages/README.md`（storage を「D1 / Google Sheets」と記載）
- **事実**: batch は DB/R2 に直接触れず、scraping API とメイン API を HTTP で呼ぶだけ（`client/scraping.ts`, `client/main.ts`）。`client/` は実質 gateway 層。ディレクトリが `batch/src/batch/` とネスト。
- **影響**: 「バッチ = データ保存層を持つ」という誤解を招く。実行主体（スケジュール起動のオーケストレータ）としての性質が命名/構造に表れていない。

---

## ISSUE-09 ✅ 解消済み api のテスト配置が src 構造と不一致（testing-conventions §2 違反）

- **場所（解消前）**: `packages/api/test/unittest/domain/entity/`, `packages/api/test/unittest/domain/validation/`
- **事実（解消前）**: api の `src/` には `domain/` も `entity/` も存在しない（それらは core にある）。にもかかわらずテストは `domain/entity` `domain/validation` 配下に置かれ、src の同構造ミラーになっていない。
- **理由**: entity/検証のテスト対象が core 由来だが、テストは api 側に置かれている。
- **影響（解消前）**: `testing-conventions.md` §2「`packages/<pkg>/test/unittest/<同構造>/`」に反し、テストとソースの対応が追いにくい。
- **対応（T-09）**: 3 ファイルとも core の関数・型のみを検証しており、core 側に同等テストが既に存在した。api 側固有のケースは core 側へ移植し、実質的な検証を持たない 1 ファイルは削除、api 側の 3 ファイルと `test/unittest/domain/` ディレクトリを削除した。

---

## ISSUE-10 ✅ 解消済み（実害あり） `core` のテストだけ `unittest/` ラッパを持たない

- **場所（解消前）**: `packages/core/test/`（`test/domain/...`, `test/utilities/...` を直下に配置）。他パッケージは `test/unittest/...`。
- **事実（解消前）**: api/scraping/batch/db は `test/unittest/` 配下、core だけ `test/` 直下にレイヤーを展開。
- **影響（解消前）**: `testing-conventions.md` §2 の一貫性が崩れるだけでなく、**実害があった**: ルートの `bun run test:unit`（`packages/*/test/unittest` グロブ）が core のテストを一切拾えていなかった。
- **対応（T-10）**: 7 レイヤーディレクトリを `test/unittest/` 配下へ移動。共有ヘルパー・パッケージ全体スモークテストは他パッケージの慣例に倣い `test/` 直下に残置。

---

## ISSUE-11 🟢 `packages/README.md` のドキュメントドリフト

- **場所**: `packages/README.md`
- **事実**:
    - 依存図・表に **実在しない `shared` パッケージ**が登場（実体は `core`）。`shared/README.md` へのリンクも切れ。
    - 依存図が「api/scraping/batch → shared、batch → db」と記すが、実際は全パッケージ → core、batch → db は無い。
    - 標準ディレクトリ構成に `service/`, `stub/`, `vitest.config.ts` を挙げるが、実在しない（実際は `usecase/`、stub 無し、`bun:test`）。
- **影響**: 新規参画者が誤ったメンタルモデルを持つ。再編時にドキュメントも更新が必要。

---

## ISSUE-12 ✅ 解消済み `di.ts` とディレクトリ `di/` の二重構造（api / scraping）

- **場所（解消前）**: `packages/api/src/di.ts` + `packages/api/src/di/{application,infrastructure}.ts`（scraping も同型）
- **事実（解消前）**: ルートに `di.ts`、配下に `di/` サブモジュール。
- **影響（解消前）**: エントリの所在が分かりにくい（軽微）。
- **対応（T-12）**: 両パッケージとも `di.ts` を `di/index.ts` へ統合。`from './di'` の既存 import はディレクトリ index 解決により変更不要。

---

## 良好な点（負債ではない）

- パッケージ間の相対 import 侵入ゼロ、循環依存ゼロ（`module-boundary-issues` の対象外だが再編で維持すべき前提）。
- `core/src/index.ts` の公開面キュレーション（#136）は境界維持に有効。
- cacheControl の「core 純関数 + 各パッケージ薄ラッパ」パターンは他の横断関心にも展開したい良い型。
