---
id: SPEC-CAL-001
title: 登録フラグ ON のレースはグレードに関わらず常にカレンダーに掲載する
status: active
raceType: all
requires:
    - UT
    - Component
targets:
    - packages/core/src/domain/policy/calendarInclusion.ts
owner: core
related:
    - aidlc-docs/inception/reverse-engineering/calendar-extraction-design.md
---

## 仕様

レースをカレンダーに掲載するか否かは、次の OR で決まる。

1. **グレード規則**を満たす:
    - 競馬系（JRA / NAR / OVERSEAS）: `isSpecified = true` のグレードであること。
    - 機械系（KEIRIN / AUTORACE / BOATRACE）: `isSpecified = true` のグレード **かつ**
      priority が下限値（`MECHANICAL_PRIORITY_THRESHOLD = 4`）以上であること。
2. または、ユーザーが個別に指定したレース（`flaggedRaceIds` に含まれる `raceId`）である。
   この場合グレードに関わらず**常に掲載**する。

## 受け入れ基準

- 競馬系: isSpecified グレードは掲載、非該当グレードは非掲載。
- 機械系: isSpecified かつ priority>=4 は掲載、priority<4 は非掲載。
- flaggedRaceIds に含まれる raceId は、グレード非該当でも掲載。
- flaggedRaceIds 未指定（空集合）でもグレード規則のみで動作する。

## 適合状況（Conformance）

- 2026-07-23 ✅適合: 実装 `shouldIncludeInCalendar` は「`rule(raceEntity) || flaggedRaceIds.has(raceId)`」で
  上記 OR を実現。閾値 4 も一致（レビュー: Sonnet、既存 UT `packages/core/test/unittest/domain/policy/calendarInclusion.test.ts`
  の U1〜U23 ケースで全分岐を確認）。
