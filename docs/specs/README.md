# 仕様レジストリ（Spec Registry）

プロダクト仕様のうち「テストと紐づけて検証したいもの」を、1 仕様 1 ファイルで構造化して記載する場所。
設計の全体像は [`.claude/docs/spec-traceability/README.md`](../../.claude/docs/spec-traceability/README.md)、
本レジストリの詳細規約は [`spec-registry.md`](../../.claude/docs/spec-traceability/spec-registry.md) を参照。

## ファイル命名

`SPEC-<domain>-<連番3桁>.md`（例: `SPEC-CAL-001.md`）。ドメイン一覧は下表。

| domain | 意味 | 主な targets |
| --- | --- | --- |
| `CAL` | カレンダー掲載・同期 | `core/src/domain/policy/`, `calendar/src/` |
| `RACE` | レース情報の取得・整形 | `core/src/domain/service/`, `scraping/src/parser/` |
| `PLACE` | 開催場所 | `core/src/domain/`, `scraping/src/` |
| `SCRAPE` | スクレイピング同期 | `scraping/src/` |
| `BATCH` | バッチオーケストレーション | `batch/src/` |
| `API` | API エンドポイント契約 | `api/src/controller/`, `api/src/router.ts` |
| `TRIP` | 旅程グループ（複数会場をセットで回る組み合わせ）の候補日検出 | `front/lib/domain/entities/trip_group_master.dart`, `front/lib/domain/entities/trip_match_finder.dart` |
| `PLAYER` | 選手データ（出走選手・注目選手登録） | `core/src/domain/policy/calendarInclusion.ts`, `api/src/repository/implement/` |

新ドメインが必要なときはこの表に 1 行足す。連番は再利用・欠番詰めをしない。

## front-matter スキーマ

```yaml
---
id: SPEC-CAL-001 # 必須。ファイル名と一致
title: 一行の要旨 # 必須
status: active # 必須。active | draft | deprecated
raceType: all # 必須。'all' か RaceType 配列
requires: # 必須。検証に必要なレイヤー（UT/Component/sIT/E2E/UAT の部分集合）
    - UT
    - Component
targets: # 必須。この仕様が統治する src ファイル/ディレクトリ
    - packages/core/src/domain/policy/calendarInclusion.ts
owner: core # 任意
related: [] # 任意
---
```

各キーの詳細規約・`requires` の決め方は
[`spec-registry.md`](../../.claude/docs/spec-traceability/spec-registry.md) §2 を参照。

## 本文の構成

```markdown
## 仕様

（自然文で仕様を記述）

## 受け入れ基準

- （テストが検証すべき観点を箇条書き）

## 適合状況（Conformance）

- （AI が targets のコードをレビューして追記。追記専用・最新を上に）
```

## 新規仕様の追加手順

1. `docs/specs/SPEC-<domain>-<NNN>.md` を作成し、上記スキーマで front-matter を書く。
2. `targets` のコードを読み、「適合状況」欄に最初のレビュー所見を記入する。
3. 該当するテスト（既存 or 新規）のファイル先頭 JSDoc に `@spec <ID>` を付与する
   （[`traceability-tags.md`](../../.claude/docs/spec-traceability/traceability-tags.md)）。
4. `bun run spec:coverage` で `requires` の各レイヤーが `covered` になっているか確認する。

## 一覧

| ID | title | status | requires |
| --- | --- | --- | --- |
| [SPEC-CAL-001](./SPEC-CAL-001.md) | 登録フラグ ON のレースはグレードに関わらず常にカレンダーに掲載する | active | UT, Component |
| [SPEC-RACE-001](./SPEC-RACE-001.md) | レース種別を機械式(競輪/オート/ボート)と競馬系(JRA/NAR/海外)に分類する | active | UT |
| [SPEC-SCRAPE-001](./SPEC-SCRAPE-001.md) | JRA/BOATRACEは年単位、それ以外は月単位でスクレイピング取得日付リストを組む | active | UT |
| [SPEC-API-001](./SPEC-API-001.md) | 書き込み系・Worker間エンドポイントはサービス間認証を必須とし、公開は明示指定のみ許す | active | UT, Component, UAT |
| [SPEC-TRIP-001](./SPEC-TRIP-001.md) | 固定の旅程グループ内で複数会場が同日/連日開催になる候補日を検出して画面表示する | active | (front/Flutterへ移設、本ツール対象外) |
| [SPEC-PLAYER-001](./SPEC-PLAYER-001.md) | 注目選手（player_watch）が出走するレースはグレードに関わらず常にカレンダーに掲載する | active | UT |
