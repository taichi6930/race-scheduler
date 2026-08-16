---
id: SPEC-RACE-001
title: レース種別を機械式(競輪/オート/ボート)と競馬系(JRA/NAR/海外)に分類する
status: active
raceType: all
requires:
    - UT
targets:
    - packages/core/src/domain/rule/raceClassification.ts
owner: core
related: []
---

## 仕様

`RaceType` を以下の2グループに分類する。

1. **機械式レース**（`isMechanicalRace`）: KEIRIN（競輪）/ AUTORACE（オート）/
   BOATRACE（ボート）。
2. **競馬系レース**（`isHorseRace`）: JRA（中央競馬）/ NAR（地方競馬）/
   OVERSEAS（海外競馬）。`race_condition` テーブル（コース種別・距離等）を
   使うのはこのグループのみ。

両分類は排他的（全 `RaceType` はちょうど一方に属する）。

## 受け入れ基準

- KEIRIN/AUTORACE/BOATRACE は `isMechanicalRace` = true、`isHorseRace` = false。
- JRA/NAR/OVERSEAS は `isHorseRace` = true、`isMechanicalRace` = false。

## 適合状況（Conformance）

- 2026-07-23 ✅適合: `MECHANICAL_RACE_TYPES`/`HORSE_RACE_TYPES` の2つの `Set` による
  排他的な分類を確認（レビュー: Sonnet、既存UT `raceClassification.test.ts` の
  12ケースで両関数×全6 RaceTypeの組み合わせを確認済み）。
- **既知のギャップ**: コンポーネントテスト（`race.get.controller.usecase.repository.component.test.ts`）は
  現状 JRA（競馬系）のケースのみを検証しており、機械式レース種別（KEIRIN等）の
  layer横断検証が無い。そのため `requires` は `UT` のみとし、`Component` は含めていない
  （false green を避けるため）。将来コンポーネントテストに機械式ケースを追加したら `requires` に
  `Component` を足し `@spec` タグを付与すること。
