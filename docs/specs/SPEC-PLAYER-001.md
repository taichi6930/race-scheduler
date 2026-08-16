---
id: SPEC-PLAYER-001
title: 注目選手（player_watch）が出走するレースはグレードに関わらず常にカレンダーに掲載する
status: active
raceType:
    - keirin
requires:
    - UT
targets:
    - packages/core/src/domain/policy/calendarInclusion.ts
    - packages/api/src/repository/implement/raceRepository.ts
    - packages/api/src/usecase/implement/calendarUsecase.ts
owner: core
related:
    - docs/specs/SPEC-CAL-001.md
    - aidlc-docs/inception/application-design/keirin-player-data-design.md
---

## 仕様

レースをカレンダーに掲載するか否かは、SPEC-CAL-001 の OR 条件（グレード規則 /
ユーザーが個別指定したレース）に加えて、次の条件が **OR** で追加される。

3. **注目選手が出走している**: `race_player`（出走表のスナップショット）と
   `player_watch`（ユーザーが登録した注目選手、`priority > 0`）を選手コード
   （`race_type` + `player_no`）で突き合わせ、1人でも該当すれば、グレードに
   関わらず**常に掲載**する。

この判定結果は `calendar_flag` テーブルへ書き込まない。`race_player` /
`player_watch` から読み取り時に導出し（`RaceRepository.fetchWatchedRaceIds`）、
既存の `flaggedRaceIds` と同じ「呼び出し側が絞り込んだ raceId 集合に対する
IN句クエリ→`Set<string>`で返す→呼び出し元でマージ」パターンに揃える。
自動判定の結果と手動フラグの結果を同じテーブルに混ぜないのは、注目選手の
登録を解除したときにどちらの意思で付いた行か区別できなくなるのを防ぐため
（keirin-player-data-design.md §2.5「却下した案」参照）。

`player_watch.priority` は現状 `0`（注目しない）/ `10`（注目する）の二値運用
だが、判定条件は `priority > 0` であり `10` という具体値には依存しない
（将来 `1`〜`9` の中間値で段階的な重み付けに拡張しても、この判定ロジック自体は
変更不要）。

## 受け入れ基準

- `race_player` に出走登録があり、対応する `player_watch` 行が `priority > 0`
  であるレースは、グレード規則・フラグに関わらず掲載対象になる
  （`shouldIncludeInCalendar` の第3引数 `watchedRaceIds`）。
- `player_watch` 行が存在しない、または `priority = 0` の選手のみが出走する
  レースは、この条件では掲載対象にならない（グレード規則・フラグ条件は
  引き続き独立して有効）。
- `watchedRaceIds` 未指定（省略・空集合）でも、グレード規則・flaggedRaceIds
  条件のみで従来通り動作する（後方互換）。
- `RaceRepository.fetchWatchedRaceIds` は空配列を渡された場合、DBへ問い合わせず
  空の `Set` を返す（`CalendarRepository.fetchFlaggedRaceIds` と同じ防御）。
- `CalendarUsecase.fetch` が返す `CalendarRaceEntity` は `isWatched` を持ち、
  `watchedRaceIds` に含まれるレースで `true` になる。

## 適合状況（Conformance）

- 2026-08-02 ✅適合: `shouldIncludeInCalendar`（`calendarInclusion.ts`）は
  `rule(raceEntity) || flaggedRaceIds.has(id) || watchedRaceIds.has(id)` で
  上記 OR を実現。`RaceRepository.fetchWatchedRaceIds` は
  `race_player INNER JOIN player_watch ON (race_type, player_no) WHERE race_id IN (...) AND priority > 0`
  で導出し、`CalendarUsecase.fetch` が `fetchFlaggedRaceIds` と並列取得して
  マージする（レビュー: Sonnet、UT
  `packages/core/test/unittest/domain/policy/calendarInclusion.test.ts`・
  `packages/api/test/unittest/repository/implement/raceRepository.test.ts`
  （W1〜W4）・`packages/api/test/unittest/usecase/implement/calendarUsecase.test.ts`
  で分岐を確認）。
