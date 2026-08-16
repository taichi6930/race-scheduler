// GradeBadge のビジュアルリグレッション（ゴールデン）テスト。
//
// グレードの表示色が Google Calendar の実際のイベント色（GⅠ=Blueberry青・
// GⅡ=Tomato赤・GⅢ=Basil緑・オープン=Tangerine橙・無印=Graphite灰）と
// 一致することを画素レベルで固定する。配色が意図せず変わるとこのテストが失敗する。
// ステージ（予選・準決勝・決勝等、オートレース/競輪/競艇のみ）はニュートラル
// 配色のピルバッジで、グレードバッジと並んで表示されることも固定する。
//
// | ID   | 条件                                      | 期待                                        |
// | ---- | ------------------------------------------ | ---------------------------------------------- |
// | T-01 | GⅠ〜無印を横並び・ライト                  | goldens/grade_badge_light.png と一致           |
// | T-02 | GⅠ〜無印を横並び・ダーク                  | goldens/grade_badge_dark.png と一致            |
// | T-03 | グレード+ステージ・ステージのみ・ライト   | goldens/grade_badge_stage_light.png と一致     |
// | T-04 | グレード+ステージ・ステージのみ・ダーク   | goldens/grade_badge_stage_dark.png と一致      |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/atoms/grade_badge.dart';
import 'package:front/domain/entities/race_type.dart';

import 'golden_test_helpers.dart';

Widget _badgeRow() {
  return const Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      GradeBadge(raceType: RaceType.jra, grade: 'GⅠ'), // blueberry
      SizedBox(width: 8),
      GradeBadge(raceType: RaceType.jra, grade: 'GⅡ'), // tomato
      SizedBox(width: 8),
      GradeBadge(raceType: RaceType.jra, grade: 'GⅢ'), // basil
      SizedBox(width: 8),
      GradeBadge(raceType: RaceType.jra, grade: 'オープン'), // tangerine
      SizedBox(width: 8),
      GradeBadge(raceType: RaceType.jra, grade: '未勝利'), // graphite
    ],
  );
}

/// オートレース・競輪・競艇特有の「ステージ」表示（グレード併記・ステージのみ）。
Widget _stageBadgeRow() {
  return const Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      GradeBadge(raceType: RaceType.autorace, grade: 'SG', raceStage: '優勝戦'),
      SizedBox(width: 8),
      GradeBadge(raceType: RaceType.keirin, grade: '', raceStage: '準決勝'),
    ],
  );
}

void main() {
  testWidgets('[T-01] グレードごとの配色_ライトテーマ', (tester) async {
    await pumpGolden(tester, _badgeRow(), surfaceSize: const Size(280, 60));

    await expectLater(
      find.byType(Row),
      matchesGoldenFile('goldens/grade_badge_light.png'),
    );
  });

  testWidgets('[T-02] グレードごとの配色_ダークテーマ', (tester) async {
    await pumpGolden(
      tester,
      _badgeRow(),
      surfaceSize: const Size(280, 60),
      dark: true,
    );

    await expectLater(
      find.byType(Row),
      matchesGoldenFile('goldens/grade_badge_dark.png'),
    );
  });

  testWidgets('[T-03] グレード+ステージ_ステージのみ_ライトテーマ', (tester) async {
    await pumpGolden(
      tester,
      _stageBadgeRow(),
      surfaceSize: const Size(220, 60),
    );

    await expectLater(
      find.byType(Row),
      matchesGoldenFile('goldens/grade_badge_stage_light.png'),
    );
  });

  testWidgets('[T-04] グレード+ステージ_ステージのみ_ダークテーマ', (tester) async {
    await pumpGolden(
      tester,
      _stageBadgeRow(),
      surfaceSize: const Size(220, 60),
      dark: true,
    );

    await expectLater(
      find.byType(Row),
      matchesGoldenFile('goldens/grade_badge_stage_dark.png'),
    );
  });
}
