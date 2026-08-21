// appRouter のルートリダイレクトのデシジョンテーブル（QWEB-04）
//
// | ID   | 条件                          | 期待                                   |
// | ---- | ----------------------------- | ---------------------------------------- |
// | T-01 | `/` へ遷移                    | `/timeline` へリダイレクトされる        |
// | T-02 | `/settings` へ遷移（対照）    | リダイレクトされずそのまま表示される    |
// | T-03 | `/invite/:token` 表示中にログイン成立 | `/timeline` へリダイレクトされる |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/app.dart';
import 'package:front/auth/application/session_provider.dart';
import 'package:front/auth/domain/auth_session.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';
import 'package:front/navigation/app_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/session_test_overrides.dart';

Future<Widget> _buildApp() async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      loggedInSessionOverride(),
      timelineProvider.overrideWith((ref, date) async => const <RaceEntity>[]),
    ],
    child: const MyApp(),
  );
}

/// T-03専用: 実際の[SessionNotifier]を使い、ログイン成立をシミュレートできる
/// ようにするための、未ログイン状態から組み立てるアプリ（他テストは常に
/// ログイン済み固定の[loggedInSessionOverride]を使うため分離した）。
Future<Widget> _buildLoggedOutApp() async {
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

  testWidgets('[T-03] 招待画面表示中にログイン成立_タイムラインへリダイレクトされる', (
    tester,
  ) async {
    // 先にログアウト状態でアプリを組み立てる（`MyApp.build()`が
    // `authRouterState`を未ログインへ同期させるため、前のテストの
    // ログイン状態が残っていても正しくリセットされる）。
    await tester.pumpWidget(await _buildLoggedOutApp());
    await tester.pumpAndSettle();

    appRouter.go('/invite/some-token');
    await tester.pumpAndSettle();

    // 招待画面は認証系ルートのためログイン前でも遷移させられず、
    // そのまま表示され続けることを前提として確認する。
    expect(
      appRouter.routerDelegate.currentConfiguration.uri.path,
      '/invite/some-token',
    );

    final container = ProviderScope.containerOf(
      tester.element(find.byType(MyApp)),
    );
    await container
        .read(sessionProvider.notifier)
        .save(const AuthSession(token: 'test-token', nickname: 'たなか'));
    await tester.pumpAndSettle();

    expect(appRouter.routerDelegate.currentConfiguration.uri.path, '/timeline');
  });
}
