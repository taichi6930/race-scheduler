// ErrorRetryCard のアクセシビリティ・連打防止に関するデシジョンテーブル（A11Y-035, QERR-07）
//
// | ID   | 条件                                   | 期待                                                            |
// | ---- | -------------------------------------- | ------------------------------------------------------------------- |
// | T-01 | 通常描画                                | エラーメッセージがliveRegionのSemanticsツリーに含まれる（能動的に通知される） |
// | T-02 | 再試行ボタン押下直後                     | クールダウン中はボタンが無効化される（連打防止）                        |
// | T-03 | クールダウン明け後に2回目の再試行を押下   | メッセージに試行回数の案内が追加される                                  |

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/error_retry_card.dart';

void main() {
  testWidgets('[T-01] 通常描画_エラーメッセージがliveRegionとして通知される', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ErrorRetryCard(message: 'データの取得に失敗しました', onRetry: () {}),
        ),
      ),
    );

    final node = tester.getSemantics(find.text('データの取得に失敗しました'));
    expect(node.flagsCollection.isLiveRegion, isTrue);
  });

  testWidgets('[T-02] 再試行押下直後_クールダウン中はボタンが無効化される', (tester) async {
    var retryCount = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(body: ErrorRetryCard(onRetry: () => retryCount++)),
      ),
    );

    await tester.tap(find.text('再試行'));
    await tester.pump();

    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull);
    expect(retryCount, 1);

    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('[T-03] クールダウン明け後に2回目の再試行を押下_試行回数がメッセージに追加される', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(body: ErrorRetryCard(onRetry: () {})),
      ),
    );

    await tester.tap(find.text('再試行'));
    await tester.pump(const Duration(seconds: 3));
    await tester.tap(find.text('再試行'));
    await tester.pump();

    expect(find.textContaining('2回目'), findsOneWidget);
  });
}
