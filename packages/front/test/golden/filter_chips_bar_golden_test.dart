// FilterChipsBar のビジュアルリグレッション（ゴールデン）テスト。
//
// 「重賞のみ／お気に入り」の独立選択チップ（両方同時ON可）と、4競技アイコン
// チップ（design-system.md の指摘により RaceType 6種ではなく Discipline 4種に
// 統一済み）の選択/非選択状態の見た目を画素レベルで固定する。
//
// | ID   | 条件                                          | 期待                                    |
// | ---- | ---------------------------------------------- | ------------------------------------------ |
// | T-01 | 重賞のみON・全競技ON                          | goldens/filter_chips_bar_default.png と一致 |
// | T-02 | お気に入りのみON・一部競技OFF（薄表示）       | goldens/filter_chips_bar_favorite.png と一致 |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/molecules/filter_chips_bar.dart';
import 'package:front/domain/entities/race_type.dart';
import 'package:front/features/timeline/application/timeline_filter_provider.dart';

import 'golden_test_helpers.dart';

void main() {
  testWidgets('[T-01] 重賞のみON_全競技ON', (tester) async {
    await pumpGolden(
      tester,
      FilterChipsBar(
        state: const TimelineFilterState(gradeOnly: true),
        enabledDisciplines: Discipline.all.toSet(),
        onToggleMode: (_) {},
        onToggleDiscipline: (_) {},
      ),
      surfaceSize: const Size(360, 56),
    );

    await expectLater(
      find.byType(FilterChipsBar),
      matchesGoldenFile('goldens/filter_chips_bar_default.png'),
    );
  });

  testWidgets('[T-02] お気に入りのみON_一部競技OFF', (tester) async {
    await pumpGolden(
      tester,
      FilterChipsBar(
        state: const TimelineFilterState(gradeOnly: false, favoriteOnly: true),
        enabledDisciplines: const {Discipline.keiba, Discipline.keirin},
        onToggleMode: (_) {},
        onToggleDiscipline: (_) {},
      ),
      surfaceSize: const Size(360, 56),
    );

    await expectLater(
      find.byType(FilterChipsBar),
      matchesGoldenFile('goldens/filter_chips_bar_favorite.png'),
    );
  });
}
