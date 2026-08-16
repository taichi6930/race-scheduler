// DisciplineIcon のアクセシビリティに関するデシジョンテーブル（A11Y-025）
//
// PERF-013: 絵文字Textをベクターアイコン（Icon）に置き換えたことに伴い、
// 見た目の検証は絵文字文字列ではなくIconDataの一致で行う。
//
// | ID   | 条件     | 期待                                                        |
// | ---- | -------- | -------------------------------------------------------------- |
// | T-01 | 通常描画 | 対応するアイコン（IconData）が表示される（見た目は変化しない） |
// | T-02 | 通常描画 | Semanticsラベルとして競技名（例:'JRA'）が読み上げられる       |
// | T-03 | 通常描画 | アイコン自体はSemanticsラベルとして重複読み上げされない       |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/atoms/discipline_icon.dart';
import 'package:front/domain/entities/race_type.dart';

Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    MaterialApp(theme: AppTheme.light(), home: Scaffold(body: child)),
  );
}

void main() {
  testWidgets('[T-01] 通常描画_対応するアイコンが表示される', (tester) async {
    await _pump(tester, const DisciplineIcon(raceType: RaceType.jra));

    expect(find.byIcon(DisciplineIcon.iconFor(RaceType.jra)), findsOneWidget);
  });

  testWidgets('[T-02] 通常描画_競技名がSemanticsラベルとして読み上げられる', (tester) async {
    await _pump(tester, const DisciplineIcon(raceType: RaceType.jra));

    expect(find.bySemanticsLabel('JRA'), findsOneWidget);
  });

  testWidgets('[T-03] 通常描画_アイコン自体はSemanticsラベルとして重複読み上げされない', (
    tester,
  ) async {
    await _pump(tester, const DisciplineIcon(raceType: RaceType.jra));

    expect(
      find.bySemanticsLabel(DisciplineIcon.emojiFor(RaceType.jra)),
      findsNothing,
    );
  });
}
