// reportTimelineFilterPersistFailure のデシジョンテーブル（QERR-11）
//
// | ID   | 条件                  | 期待                                |
// | ---- | --------------------- | -------------------------------------- |
// | T-01 | 永続化に成功（true）  | SnackBarは表示されない              |
// | T-02 | 永続化に失敗（false） | 失敗を知らせるSnackBarが表示される  |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/features/timeline/application/timeline_filter_feedback.dart';

void main() {
  Widget buildApp(Future<bool> Function() persist) {
    return MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => ElevatedButton(
            onPressed: () =>
                reportTimelineFilterPersistFailure(context, persist()),
            child: const Text('保存'),
          ),
        ),
      ),
    );
  }

  testWidgets('[T-01] 永続化に成功_SnackBarは表示されない', (tester) async {
    await tester.pumpWidget(buildApp(() async => true));

    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();

    expect(find.text('絞り込み条件の保存に失敗しました'), findsNothing);
  });

  testWidgets('[T-02] 永続化に失敗_失敗を知らせるSnackBarが表示される', (tester) async {
    await tester.pumpWidget(buildApp(() async => false));

    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();

    expect(find.text('絞り込み条件の保存に失敗しました'), findsOneWidget);
  });
}
