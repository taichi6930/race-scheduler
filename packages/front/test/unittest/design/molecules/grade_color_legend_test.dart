// GradeColorLegend のデシジョンテーブル（A11Y-030）
//
// | ID   | 条件     | 期待                                                    |
// | ---- | -------- | ------------------------------------------------------------ |
// | T-01 | 通常描画 | 各グレード区分のラベルがSemanticsラベルとして読み上げられる |
// | T-02 | 通常描画 | 凡例全体がグループとしてラベル付けされる                    |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/grade_color_legend.dart';

Future<void> _pump(WidgetTester tester) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: const Scaffold(body: GradeColorLegend()),
    ),
  );
}

void main() {
  testWidgets('[T-01] 通常描画_各グレード区分のラベルが読み上げられる', (tester) async {
    await _pump(tester);

    expect(find.bySemanticsLabel('GⅠ/SG/GP'), findsOneWidget);
    expect(find.bySemanticsLabel('GⅡ/G1'), findsOneWidget);
    expect(find.bySemanticsLabel('GⅢ/G2'), findsOneWidget);
    expect(find.bySemanticsLabel('G3/OP'), findsOneWidget);
    expect(find.bySemanticsLabel('無印'), findsOneWidget);
  });

  testWidgets('[T-02] 通常描画_凡例全体がグループとしてラベル付けされる', (tester) async {
    await _pump(tester);

    expect(find.bySemanticsLabel('グレード配色の凡例'), findsOneWidget);
  });
}
