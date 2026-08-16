// AppShell のタブ切替キーボードショートカットのデシジョンテーブル（QWEB-06）
//
// | ID   | 条件                              | 期待                             |
// | ---- | --------------------------------- | -------------------------------- |
// | T-01 | タイムライン表示中にCtrl+2を押す  | お気に入りタブへ切り替わる       |
// | T-02 | タイムライン表示中にCtrl+3を押す  | 設定タブへ切り替わる             |
// | T-03 | Ctrlを押さずに2キーのみ押す       | タブは切り替わらない（対照）     |

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

  testWidgets('[T-01] タイムライン表示中にCtrl+2を押す_お気に入りタブへ切り替わる', (
    tester,
  ) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();

    await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
    await tester.sendKeyEvent(LogicalKeyboardKey.digit2);
    await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
    await tester.pumpAndSettle();

    expect(
      appRouter.routerDelegate.currentConfiguration.uri.path,
      '/favorites',
    );
  });

  testWidgets('[T-02] タイムライン表示中にCtrl+3を押す_設定タブへ切り替わる', (tester) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();

    await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
    await tester.sendKeyEvent(LogicalKeyboardKey.digit3);
    await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
    await tester.pumpAndSettle();

    expect(
      appRouter.routerDelegate.currentConfiguration.uri.path,
      '/settings',
    );
  });

  testWidgets('[T-03] Ctrlを押さずに2キーのみ押す_タブは切り替わらない', (tester) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();

    await tester.sendKeyEvent(LogicalKeyboardKey.digit2);
    await tester.pumpAndSettle();

    expect(
      appRouter.routerDelegate.currentConfiguration.uri.path,
      '/timeline',
    );
  });
}
