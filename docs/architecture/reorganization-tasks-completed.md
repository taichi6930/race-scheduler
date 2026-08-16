# 再編タスク 完了済みアーカイブ（Phase 0〜1）

> [`reorganization-tasks.md`](./reorganization-tasks.md) の運用ルール（AUT-06: 完了項目はSELECT走査対象から
> 外すため本体から削除し、判断根拠の記録価値を保つためこのアーカイブへ移す）に従い、Phase 0〜1（T-00〜T-12）
> の完了済みブロックをここへ移動した。**このファイルはSELECT走査の対象外**（loop-engineering の `structure`
> recipe は `docs/tasks/BACKLOG.md` §F のみを読み、詳細ソースの `reorganization-tasks.md` 本体は Phase 2/3
> のみを持つため、本アーカイブは参照されない）。

---

## Phase 0 — 前提整備（低リスク・先行）

### [x] T-00 `packages/README.md` のドキュメントドリフト修正

- **何を**: 実在しない `shared` パッケージ記述を `core` に修正。依存図を「全パッケージ → core」に是正。標準構成の `service/` `stub/` `vitest.config.ts` を実態（`usecase/`, stub 無し, `bun:test`）へ修正。あわせて batch のバッチ処理説明（CSVインポート・ワークフロー名等）の記述ドリフトも実態に合わせて修正。
- **なぜ**: 誤ったメンタルモデルを除去し、以降の再編の共通認識を作る（ISSUE-11）。
- **影響範囲**: ドキュメントのみ。コード影響なし。
- **結果**: 完了（`packages/README.md` 修正済み）。

---

## Phase 1 — 内部整理（Option A / 各 1 PR）

### [x] T-01 `db` パッケージのデッドコード判断と対応方針の確定

- **何を**: `db/src/types/schemas.ts` と `db/src/models/*.model.ts` が未使用であることを確認のうえ、(a) 削除、(b) api の mapper が参照する「DB スキーマの正」として採用、のいずれかを決定。まずは調査 + 方針 PR（or Issue）。
- **なぜ**: DB スキーマの二重管理を解消（ISSUE-01）。
- **影響範囲**: db パッケージ、（採用する場合）api の repository/mapper。migrations は不変。
- **結果**: **(a) 削除を採用**。理由: api の読み取りクエリ（`raceMapper.ts` 等）は複数テーブルを JOIN した非正規化結果を返しており、db の単一テーブル `Row` 型とは構造的に一致しない（api 側は既に用途別の permissive な Zod スキーマで独自に検証している）。書き込み側も `batchUpsert<T>` という `columns: string[]` 駆動の汎用ヘルパーで、テーブル別の `Insert` 型を機械的に当てはめても型安全性の実利が薄い。よって `src/types/schemas.ts` / `src/models/*.model.ts` とその対応テストを削除し、db パッケージは migrations 専用とした。DB スキーマの正は `migrations/*.sql` のまま変わらず、api 側のクエリ結果検証（Zod）が引き続き実質的な安全網を担う。**T-02 はこの決定により不要（スキップ）**。

### ~~T-02~~ （T-01 の決定によりスキップ）

- ~~api mapper を `db` の Row 型に接続~~ — T-01 で「削除」を採用したため対象外。api 側の JOIN 結果 / 汎用 UPSERT の構造上、db の単一テーブル Row 型を機械的に適用する設計上のメリットが薄いと判断。将来的に api のクエリを単一テーブル取得中心へ設計し直す場合は再検討の余地あり。

### [x] T-03 core の値オブジェクトを 1 箇所に統合

- **何を**: `core/src/types/` のブランド値オブジェクトを `core/src/domain/model/valueObject/` に集約（DTO 純粋型は `types/` に残す線引きを定義）。`utilities/raceStage.ts` と VO 版 raceStage の重複解消。
- **なぜ**: 新規 VO の置き場を一意にし発見性を上げる（ISSUE-03）。
- **影響範囲**: core 内部の import と `core/src/index.ts` の re-export パス。他パッケージは公開面経由なので barrel を保てば影響最小。
- **結果**: 完了。`heldDayTimes`/`heldTimes`/`horseRaceCondition`/`placeHeldDays`/`playerNumber`/`positionNumber`/`raceDateTime`/`raceDistance`/`raceName`/`raceNumber`/`raceType`/`surfaceType` の 12 ファイルを `domain/model/valueObject/` へ移動（対応テストも `test/domain/model/valueObject/` へ移動）。`types/` には DTO/Error（`upsertApiResponse.ts`, `validationError.ts`）のみ残した。`core/src/index.ts` の公開シンボル名は変更していないため他パッケージへの影響なし。**`utilities/raceStage.ts` の重複は誤検知だった**: 実体は Zod スキーマの VO ではなく「DB から `RaceGradeAndStageList` 相当のデータを取得しフォールバックする関数」であり、`domain/model/valueObject/raceStage.ts`（純粋な VO スキーマ）とは別の関心事のため、統合対象から除外した。

### [x] T-04 core の `controller/` を `http/` に統合

- **何を**: `core/src/controller/`（parse, parseBodyOrBadRequest, parseOrBadRequest, response）を `core/src/http/` へ移設し `controller/` を廃止。`index.ts` の re-export を維持。
- **なぜ**: HTTP 境界ヘルパーの二重ディレクトリと「共有ライブラリ内 controller」という誤命名を解消（ISSUE-04）。
- **影響範囲**: core 内部 import と barrel。公開シンボル名は据え置けば他パッケージ無影響。
- **結果**: 完了。4 ファイルと対応テストを `http/` へ移動し `controller/` を削除。`core/src/index.ts` の公開シンボル名（`badRequest`, `json`, `parseBodyOrBadRequest` 等）は変更していないため他パッケージへの影響なし。

### [x] T-05 core の検証（schemas/filters）を集約

- **何を**: `core/src/filters/` と `core/src/schemas/` の責務境界を定義し、検証ロジックを `schemas/` に寄せる（フィルタ結果型など純粋型は分離）。
- **なぜ**: 検証の三系統分散を解消（ISSUE-05）。
- **影響範囲**: core 内部と barrel。
- **結果**: **前提が誤りと判明**。`filters/` の中身（`CalendarFilterParams`, `CalendarUpsertResult`）は実際には Zod 検証ロジックを一切持たない**純粋な DTO 型定義**であり、`schemas/` の Zod バリデーションとは別物（統合すべき重複ではなかった）。「検証の三系統分散」は誤検知。実態に合わせ `filters/` → `dto/` へリネームし、命名の誤解（"filters" が検証を連想させる）のみ解消した。`schemas/` 側は変更なし。

### [x] T-06 router / エラーハンドラ / キャッシュ middleware の共通化

- **何を**: `consolidate-router` skill に従い、api/batch/scraping の Hono エラーハンドラ・CORS・キャッシュ配線を共通化（core に「純関数 + 各パッケージ薄ラッパ」型で提供、既存 cacheControl パターンを横展開）。
- **なぜ**: 3 Worker の router 重複を解消（ISSUE-06）。
- **影響範囲**: api/batch/scraping の `router.ts` と各 `utility/`、core の http。専用 skill/agent あり。
- **結果**: 部分的に完了。`consolidate-router` skill の記載（api のエラーハンドラ 12 箇所・キャッシュ 4 箇所の共通化）は既に実施済みで前提が古かった（api は既に `errorHandler.ts`/`cacheControl.ts` に集約済み）。実際に残っていた重複は「500 エラーのログ出力＋応答ボディ組み立て」パターンが api（`handleApiError`）/ batch / scraping の 3 箇所に分散していた点で、これを core の新関数 `logInternalError(logMessage, error)` に集約し、3 パッケージすべてから呼び出すよう統一した。**副次的な安全性改善**: batch は従来 `appLogger.error('Batch execution failed:', error)` で未サニタイズの生エラーをログ出力しており秘密情報漏洩の懸念があったが、`logInternalError` 経由で api と同じ `sanitizeError` によるマスク処理が適用されるようになった。scraping は従来エラーログを一切出力していなかったが、同様にサニタイズ済みログが追加された。CORS 設定（`cors({...})` オプション）の重複は api 側が per-request キャッシュ最適化のため独自の `resolveAllowedOrigins`/`DEFAULT_ALLOWED_ORIGINS` を持つなど設計差異があり、セキュリティに関わる領域のため安易な統合はリスクが高いと判断し、本タスクの範囲外とした（統合するなら別タスクとして深く調査すべき）。

### [x] T-07 place/race 変換ロジックの core 集約

- **何を**: `api/repository/.../placeMapper|raceMapper`、`scraping/utility/mapPlaceEntityToDto|mapRaceHtmlEntityToDto`、`batch/util/batchEntityHelpers` の共通変換を core（domain/service or entity）へ抽出。
- **なぜ**: ドメインモデル変更時の追随箇所を 1 つに（ISSUE-07）。
- **影響範囲**: api/scraping/batch の変換箇所、core。段階的に片側ずつ移行可。
- **結果**: **調査の結果、抽出すべき実質的な重複ロジックは無いと判明**。3 つの変換関数は型・方向・検証戦略が異なる別々の正当な処理: (a) api の `placeMapper`/`raceMapper` は **DB Row（`Record<string, unknown>`、JOIN 済み非正規化結果）→ Entity** の変換で Zod による厳密検証を伴う、(b) scraping の `mapPlaceEntityToDto`/`mapRaceHtmlEntityToDto` は **Entity → DTO（HTTP 転送用に Date を JST ISO 文字列化）** の単純なフィールド射影、(c) batch の `batchEntityHelpers`（`toValidDate`/`resolveLocationCode`）は **DTO → Entity 再構築時の未検証ネットワーク入力に対する妥当性チェック**。これらを無理に 1 つの共通関数へ統合すると、型・検証責務の異なる処理を不自然に混ぜる過剰な抽象化になる（コーディング規約の「タスクが要求する以上の抽象化を避ける」に反する）。**むしろ既に理想形が実現済み**: 実際に共有すべきドメインロジックである「開催場名 ⇔ コード解決」（`findPlaceCodeByName`/`findPlaceNameByCode`）は既に core に置かれ、api/scraping/batch の 3 パッケージ全てがそれを利用しており、ISSUE-07 が目指す「変更箇所を 1 つに」は既存の core 関数によって達成されている。追加の抽出は行わなかった。

### [x] T-08 batch の JST ユーティリティを core に統一

- **何を**: `batch/src/util/timezone.ts` の `formatJstDatetime` 等を `core/src/utilities/dateJst.ts` の関数で置換、または core へ移設。
- **なぜ**: 日時ロジックの重複解消（ISSUE-06 派生 / dependency-analysis 3.6）。
- **結果**: 完了。挙動を変えず `formatJstDatetime` を `core/src/utilities/dateJst.ts` へ物理移設（既存の `getJst*`/`toJstISOString` 等で再実装すると、6 桁年の境界エラー等の細かな挙動差異が生じるリスクがあるため、既存関数の置換ではなく移設を選択）。`batch/src/util/timezone.ts` は削除し、`batch/src/batch/place.ts` / `race.ts` は `@race-schedule/core` から import。対応テストも `core/test/utilities/dateJst.test.ts` の `formatJstDatetime` describe ブロックへ統合した。
- **影響範囲**: batch の util と呼び出し元。

### [x] T-09 api テスト配置を src 構造にミラー

- **何を**: `api/test/unittest/domain/entity` `domain/validation` を、対象が core 由来なら core 側テストへ移すか、api の実際の src レイヤー（usecase/controller/repository）に沿う配置へ是正。
- **なぜ**: `testing-conventions.md` §2「同構造」違反の解消（ISSUE-09）。
- **影響範囲**: api の test ディレクトリのみ（src 不変）。
- **結果**: 完了。3 ファイル（`playerEntity.test.ts`, `playerValidation.test.ts`, `searchPlayerFilterEntity.test.ts`）はいずれも api の src ではなく `@race-schedule/core` の関数・型のみを検証しており、core 側に同等テスト（`core/test/entity/playerEntity.test.ts`, `core/test/schemas/playerValidation.test.ts`, `core/test/schemas/playerFilterValidation.test.ts`）が既に存在した。api 側だけに存在した固有ケース（priority の文字列数値変換、ValidationError の status 検証、余分フィールド拒否、raceType 空文字）は core 側テストへ移植し、`searchPlayerFilterEntity.test.ts` は型リテラル構築のみで実質的な検証ロジックを持たない（TypeScript の型システムが既に保証する内容の重複）ため移植せず削除。api 側の 3 ファイルは削除し `test/unittest/domain/` ディレクトリ自体を解消した。`core` の対象 src ファイル（`playerEntity.ts`, `playerValidation.ts`, `playerFilterValidation.ts`）は C0/C1 100% を維持。

### [x] T-10 core テストの `unittest/` 階層統一

- **何を**: `core/test/` 直下のレイヤーを `core/test/unittest/` 配下へ移し、他パッケージと階層を揃える。
- **なぜ**: テスト配置規約の一貫性（ISSUE-10）。
- **影響範囲**: core の test ディレクトリのみ。テストランナーのパス指定確認。
- **結果**: 完了。`domain/dto/entity/http/schemas/types/utilities` の 7 レイヤーを `test/unittest/` 配下へ移動（66 ファイルの相対 import を新しい深さへ再計算して修正）。共有テストヘルパー（`MockInterface.ts`, `test/index.ts`）とパッケージ全体のスモークテスト（`exports.test.ts`）は api の `test/mock`・`test/common`・`test/router.test.ts` 等の慣例に倣い `test/` 直下に残した。**単なる体裁の問題ではなく実害があった**: ルートの `bun run test:unit`（`packages/*/test/unittest` パターン）が、この移動前は core のテストを一切拾えていなかった（`test/unittest/` 配下ではなかったため）。移動により core の UT が `test:unit` で正しく実行されるようになった。

### [x] T-11 core の環境依存 utility を分離（ディレクトリレベル）

- **何を**: `core/src/utilities/` の環境依存（`cloudFlareEnv`, `envStore`, `envFlag`, `diInitializer`, `validateEnv`）を純関数 utility と別サブディレクトリ（例 `platform/`）に分離。
- **なぜ**: 純ドメイン/純 utility とインフラ依存の混在を解消し、Phase 2（core 分割）の切り出し線を先に可視化（ISSUE-02）。
- **影響範囲**: core 内部 import と barrel。パッケージ分割はしない（軽い前準備）。
- **結果**: 完了。5 ファイルと対応テスト（`diInitializer`/`envStore`/`validateEnv`。`cloudFlareEnv`/`envFlag` はテスト未整備で対象外）を `utilities/platform/` へ移動。`utilities/index.ts` の barrel を更新し、公開シンボル名は変更していないため他パッケージへの影響なし。Phase 2（core 物理分割）を選択する際は `platform/` が `@race-schedule/shared` 等への切り出し候補として自明になった。

### [x] T-12 di 二重構造の整理（任意・軽微）

- **何を**: `api/src/di.ts` + `di/` および scraping 同型を、単一の入口へ集約（例 `di/index.ts`）。
- **なぜ**: DI 入口の所在を明確化（ISSUE-12）。
- **影響範囲**: api/scraping の di とエントリ import。
- **結果**: 完了。両パッケージとも `di.ts` を `di/index.ts` へ移動し `di/` 配下に統合。`from './di'` で参照している既存の import 文（router.ts 等）は TypeScript のディレクトリ index 解決により変更不要だった。scraping の `test/unittest/di.test.ts` も同様に `test/unittest/di/index.test.ts` へ統合し、api の既存テスト配置（`test/unittest/di/{byEnvironment,infrastructure,application}.test.ts`）と一貫させた。
