// appRouter の errorBuilder（NAV-02）に関するデシジョンテーブル
//
// | ID   | 条件                              | 期待                                        |
// | ---- | ---------------------------------- | ---------------------------------------------- |
// | T-01 | 存在しないパスへ遷移              | go_router既定のエラーページではなくNotFoundScreenが表示される |
// | T-02 | NotFoundScreenで「タイムラインへ戻る」をタップ | /timelineへ遷移する           |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/app.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';
import 'package:front/navigation/app_router.dart';
import 'package:front/navigation/not_found_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<Widget> _buildApp() async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      timelineProvider.overrideWith((ref, date) async => const <RaceEntity>[]),
    ],
    child: const MyApp(),
  );
}

void main() {
  setUp(() {
    // GoRouter はモジュールレベルの単一インスタンスのため、
    // テスト間の状態リークを防ぐため毎回初期位置に戻す。
    appRouter.go('/timeline');
  });

  testWidgets('[T-01] 存在しないパスへ遷移_NotFoundScreenが表示される', (tester) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();

    appRouter.go('/does-not-exist');
    await tester.pumpAndSettle();

    expect(find.byType(NotFoundScreen), findsOneWidget);
    expect(find.text('お探しのページが見つかりませんでした'), findsOneWidget);
  });

  testWidgets('[T-02] 戻るボタンをタップ_timelineへ遷移する', (tester) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();
    appRouter.go('/does-not-exist');
    await tester.pumpAndSettle();

    await tester.tap(find.text('タイムラインへ戻る'));
    await tester.pumpAndSettle();

    expect(find.byType(NotFoundScreen), findsNothing);
    expect(
      appRouter.routerDelegate.currentConfiguration.uri.toString(),
      '/timeline',
    );
  });
}
