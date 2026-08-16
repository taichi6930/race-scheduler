// GradeBadge の表示ロジックのデシジョンテーブル
//
// | ID   | 条件                              | 期待                                  |
// | ---- | --------------------------------- | ---------------------------------------- |
// | T-01 | grade あり・raceStage なし        | グレードのみ表示される                |
// | T-02 | grade あり・raceStage あり        | グレード・ステージが両方表示される    |
// | T-03 | grade なし（空文字）・raceStage あり | ステージのみ表示される（平場・決勝等） |
// | T-04 | grade なし・raceStage なし        | 何も表示されない（SizedBox.shrink）   |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/atoms/grade_badge.dart';
import 'package:front/domain/entities/race_type.dart';

Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    MaterialApp(theme: AppTheme.light(), home: Scaffold(body: child)),
  );
}

void main() {
  testWidgets('[T-01] gradeあり_raceStageなし_グレードのみ表示される', (tester) async {
    await _pump(
      tester,
      const GradeBadge(raceType: RaceType.autorace, grade: 'SG'),
    );

    expect(find.text('SG'), findsOneWidget);
  });

  testWidgets('[T-02] gradeあり_raceStageあり_グレードとステージが両方表示される', (
    tester,
  ) async {
    await _pump(
      tester,
      const GradeBadge(
        raceType: RaceType.autorace,
        grade: 'SG',
        raceStage: '優勝戦',
      ),
    );

    expect(find.text('SG'), findsOneWidget);
    expect(find.text('優勝戦'), findsOneWidget);
  });

  testWidgets('[T-03] gradeなし_raceStageあり_ステージのみ表示される', (tester) async {
    await _pump(
      tester,
      const GradeBadge(
        raceType: RaceType.keirin,
        grade: '',
        raceStage: '準決勝',
      ),
    );

    expect(find.text('準決勝'), findsOneWidget);
  });

  testWidgets('[T-04] gradeなし_raceStageなし_何も表示されない', (tester) async {
    await _pump(
      tester,
      const GradeBadge(raceType: RaceType.jra, grade: ''),
    );

    expect(find.byType(SizedBox), findsOneWidget);
    final sizedBox = tester.widget<SizedBox>(find.byType(SizedBox));
    expect(sizedBox.width, 0);
    expect(sizedBox.height, 0);
  });
}
