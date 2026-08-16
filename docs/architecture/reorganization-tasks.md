# 再編タスク チェックリスト（1 PR 相当の粒度）

> **統合先**: 本ファイルは全体マスターボード [`docs/tasks/BACKLOG.md`](../../docs/tasks/BACKLOG.md) の
> **カテゴリ F（構造/再編）の「詳細ソース」**。**未着手の Phase 2/3（T-20/21/22/30）は BACKLOG §F の
> STR-01〜04 に対応し、いずれも着手前にユーザー承認が必要**（`needs-approval`）。
>
> **運用ルール（AUT-06）**: 完了したタスクはこのファイルから削除し、判断根拠の記録価値を保つため
> [`reorganization-tasks-completed.md`](./reorganization-tasks-completed.md) へ移す（BACKLOG.md の
> 「完了＝行削除」原則と統一。SELECT 走査の対象を膨らませないため）。Phase 0〜1（T-00〜T-12）は
> 2026-07-23 時点で全件完了済みのため同ファイルへ移動済み。

> `reorganization-proposal.md` の段階移行を、実行可能な PR 単位へ分解したもの。
> 各タスクは **何を / なぜ / 影響範囲** を明記。
> 前提: すべて `claude/xxxx` ブランチで作業、`bun run lint` / `type-check` / `bun test` green を各 PR の完了条件とする。

> **検証メモ（実コードで裏取り済み）**: 以下の前提は実コードで確認済み。
>
> - `@race-schedule/db` はどのパッケージからも import されず、依存宣言もゼロ（db の実価値は `migrations/*.sql` 0001〜0015 と wrangler d1 設定。**デッドなのは `src/models/*.ts` / `src/types/schemas.ts` の TS 層のみ**で、db パッケージ自体は削除しない）。
> - VO は `core/src/types/`（14 ファイル）と `core/src/domain/model/valueObject/`（7 ファイル）に二重配置。`raceStage` は `utilities/raceStage.ts` と `domain/model/valueObject/raceStage.ts` に重複。
> - place/race 変換は api mapper / scraping map\*ToDto / batch batchEntityHelpers の 3 パッケージに分散。
> - `router.ts` は api / batch / scraping の 3 Worker に重複。
> - 依存グラフは全 TS パッケージ → `core` の単方向スター（循環ゼロ、境界越え相対 import ゼロ）。`core` は他 TS パッケージを import しない。

---

> **現状評価（2026-07-24・構造監査で裏取り）**: 全パッケージ横断の構造監査（`docs/tasks/TASK_LIST.md` #119〜#142 の起票と同時に実施）で、T-20/T-21 の前提が一部**陳腐化・更新**されていることを確認した。
>
> - **VO 二重配置は既に解消済み**: 旧記述「VO は `core/src/types/`（14 ファイル）と `domain/model/valueObject/`（7 ファイル）に二重配置」は現状と乖離。実際は `types/` は 3 ファイル（`upsertApiResponse.ts`/`validationError.ts`/`index.ts`）まで縮小し、VO は `domain/model/valueObject/`（20 ファイル）へ集約済み。残る `types/` の形骸化は #132（解体タスク）で扱う。
> - **T-20/T-21 の真の障害は `domain ↔ utilities` の相互依存**: 「純ドメイン(domain) / 共有インフラ(utilities/http/constants)」への物理二分は**現状のままでは不可能**。実測した絡まり:
>     - `utilities/raceStage.ts`・`utilities/makeRaceTypeScopedStringSchema.ts` → `domain/model/valueObject/raceType`・`domain/master` を import（utilities → domain の逆方向）。
>     - 一方 `domain/model/valueObject/*`（gradeType/surfaceType/raceCourse/raceName/raceDistance/placeHeldDays/horseRaceCondition）と `domain/policy/*` は `utilities/{makeValidator,makeRaceTypeScopedStringSchema,dateJst,format,url,createAnchorTag}` に広く依存（domain → utilities の正方向）。
>       → 双方向依存のため、単純に切り出すと循環パッケージ依存（`import/no-cycle` 違反）になる。
> - **T-20/T-21 着手前に必要な前提タスク（いずれも core 内で完結、`needs-approval` 不要で先行可能）**:
>     1. ✅完了（死んでいたD1フォールバック経路の削除、2026-08-07）: `raceStage.ts` の DB ローダ（`getRaceGradeAndStageList`）は
>        `domain/master/` へ移す代わりに、TS定数（core）を唯一の正典とする方針が確定し**ファイルごと削除**した
>        （#115参照）。utilities → domain/master の逆流はこれで解消済み。
>     2. `makeValidator`/`makeRaceTypeScopedStringSchema` の帰属を決める（VO が広く依存するため domain 寄りに置くか、`shared` の「ドメイン非依存な検証プリミティブ」に限定するか）。
>     3. `policy/calendarDescription` の URL/anchor 依存（`utilities/{url,createAnchorTag}`）を整理し、policy が shared のどこに依存してよいかを確定する。
>     4. `types/` の解体（#132）と `entity`/`schemas`/`dto` の境界再定義（#133）を先に済ませ、分割対象の輪郭を確定する。
>        → 上記 2〜4 を先に消化してから T-20/T-21 に入ると、パッケージ分割時の循環を避けられる。これらは物理分割ではなく core 内の整理なので、ループ（`refactor` recipe）で先行して進められる。

## Phase 2 — core の物理分割（Option B / 任意・要承認）

### [ ] T-20 `@race-schedule/domain` の切り出し

- **何を**: T-03〜T-05, T-11 で境界を整えた後、`core/src/domain/` + `entity/` を新パッケージ `@race-schedule/domain` として分離。
- **なぜ**: 純ドメインを環境依存から物理的に独立させ、テスト高速化・再利用境界の明確化（ISSUE-02）。
- **影響範囲**: 全 TS パッケージの該当 import（`@race-schedule/core` 参照はソース 103 / テスト込み 227 箇所の一部、実測）。`core` は互換 barrel を一時提供し段階置換。CI 全通し必須。

### [ ] T-21 `@race-schedule/shared`（or `platform`）の切り出し

- **何を**: `http/`, `utilities/`, `constants/`, 環境依存 `platform/` を `@race-schedule/shared` へ。
- **なぜ**: 共有インフラ/HTTP をドメインと分離。
- **影響範囲**: 全 TS パッケージの import、barrel 再設計。T-20 と連動。

### [ ] T-22 旧 `core` barrel の撤去 or 再定義

- **何を**: 互換のため残した `@race-schedule/core` を、domain/shared への薄い再 export に縮小、または全 import 置換後に廃止。
- **なぜ**: 移行完了後の二重メンテ解消。
- **影響範囲**: 全パッケージ。最後に実施。

---

## Phase 3 — 実行主体軸リネーム（Option C / 任意・最後）

### [ ] T-30 パッケージ命名の実行主体軸への統一（要合意）

- **何を**: `worker-api` / `worker-scraping` / `job-batch`（`batch/src/batch/` ネスト解消含む）/ `lib-domain` / `lib-shared` / `db-migrations` / `app-front` 等へリネーム。
- **なぜ**: リポジトリ構造を一目で分類可能に。
- **影響範囲**: package.json name、wrangler.toml、CI/デプロイ設定、全 import、ドキュメント全般。churn 最大のため単独 PR かつ十分な合意の後に。

---

## 完了条件（各 PR 共通）

- [ ] `bun run lint`（`import/no-cycle`, `no-relative-packages`, `no-explicit-any` 含む）エラーなし
- [ ] `bun run type-check` エラーなし
- [ ] 影響パッケージの `bun test` green（該当 src の C0/C1 100% 維持）
- [ ] `core/src/index.ts` の公開面キュレーション（#136）を崩していない
- [ ] 循環依存ゼロ・パッケージ境界越え相対 import ゼロを維持
