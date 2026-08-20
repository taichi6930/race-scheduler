// appRouter のルートリダイレクトのデシジョンテーブル（QWEB-04）
//
// | ID   | 条件                          | 期待                                   |
// | ---- | ----------------------------- | ---------------------------------------- |
// | T-01 | `/` へ遷移                    | `/timeline` へリダイレクトされる        |
// | T-02 | `/settings` へ遷移（対照）    | リダイレクトされずそのまま表示される    |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/app.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';
import 'package:front/navigation/app_router.dart';
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

  testWidgets('[T-01] ルート_タイムライン画面へリダイレクトされる', (tester) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();

    appRouter.go('/');
    await tester.pumpAndSettle();

    expect(appRouter.routerDelegate.currentConfiguration.uri.path, '/timeline');
  });

  testWidgets('[T-02] 設定へ遷移_リダイレクトされずそのまま表示される', (tester) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();

    appRouter.go('/settings');
    await tester.pumpAndSettle();

    expect(appRouter.routerDelegate.currentConfiguration.uri.path, '/settings');
    expect(find.widgetWithText(AppBar, '設定'), findsOneWidget);
  });
}
