---
id: SPEC-SCRAPE-001
title: JRA/BOATRACEは年単位、それ以外は月単位でスクレイピング取得日付リストを組む
status: active
raceType: all
requires:
    - UT
targets:
    - packages/core/src/domain/policy/fetchCadence.ts
    - packages/scraping/src/usecase/implement/placeUsecase.ts
owner: scraping
related: []
---

## 仕様

スクレイピング対象日付の取得粒度は `raceType` によって異なる。

1. **年単位取得**（`isYearlyFetchRaceType` = true）: JRA / BOATRACE。
   `startDate`〜`finishDate` の範囲を各年の1月1日で網羅するリストを作る。
2. **月単位取得**（それ以外: NAR / KEIRIN / AUTORACE / OVERSEAS）:
   範囲を各月の1日で網羅するリストを作る。

`packages/scraping` の `placeUsecase` がこのリストを使い、日付ごとに
スクレイピング対象サイトへのリクエストを組み立てる（取得元サイトの
ページ単位が年単位/月単位で異なるドメイン知識を吸収する）。

## 受け入れ基準

- JRA・BOATRACE は `isYearlyFetchRaceType` = true。
- NAR・KEIRIN・AUTORACE・OVERSEAS は `isYearlyFetchRaceType` = false。
- 年単位: 範囲が複数年にまたがる場合、各年の1月1日を1件ずつ含む。同一年内なら1件。
- 月単位: 範囲が複数月にまたがる場合、各月の1日を1件ずつ含む。同一月内なら1件。

## 適合状況（Conformance）

- 2026-07-23 ✅適合: `fetchCadence.ts` の `isYearlyFetchRaceType`/`buildFetchDateList` は
  上記の年単位/月単位ロジックをそのまま実装している（レビュー: Sonnet、既存UT
  `fetchCadence.test.ts` のT-01〜T-08で両関数の主要ケースを確認済み）。
- **既知のギャップ**: `placeUsecase.ts` での実際の利用箇所を層横断で検証する
  コンポーネントテスト/sIT は未整備。`requires` は `UT` のみとする。
