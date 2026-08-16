// EmptyState のアクセシビリティに関するデシジョンテーブル（A11Y-029）
//
// | ID   | 条件     | 期待                                                    |
// | ---- | -------- | ------------------------------------------------------------ |
// | T-01 | 通常描画 | messageがSemanticsラベルとして読み上げられる           |
// | T-02 | 通常描画 | 装飾アイコン自体はSemanticsラベルとして重複読み上げされない |
// | T-03 | action省略時（QEMP-01） | アクション領域は表示されない |
// | T-04 | action指定時（QEMP-01） | 指定したウィジェットが表示される |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/empty_state.dart';

const _message = 'お気に入りはまだありません。';

Future<void> _pump(WidgetTester tester, {Widget? action}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: EmptyState(icon: '☆', message: _message, action: action),
      ),
    ),
  );
}

void main() {
  testWidgets('[T-01] 通常描画_messageがSemanticsラベルとして読み上げられる', (tester) async {
    await _pump(tester);

    expect(find.bySemanticsLabel(_message), findsOneWidget);
  });

  testWidgets('[T-02] 通常描画_装飾アイコンはSemanticsラベルとして重複読み上げされない', (tester) async {
    await _pump(tester);

    expect(find.bySemanticsLabel('☆'), findsNothing);
  });

  testWidgets('[T-03] action省略時_アクション領域は表示されない', (tester) async {
    await _pump(tester);

    expect(find.byType(TextButton), findsNothing);
  });

  testWidgets('[T-04] action指定時_指定したウィジェットが表示される', (tester) async {
    await _pump(
      tester,
      action: TextButton(onPressed: () {}, child: const Text('タイムラインを見る')),
    );

    expect(find.widgetWithText(TextButton, 'タイムラインを見る'), findsOneWidget);
  });
}
