// WhatsNewNoticeListener のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                          |
// | ---- | -------------------------------------------- | ---------------------------------------------- |
// | T-01 | whatsNewNoticeProviderがtrue                | SnackBarでお知らせが表示される               |
// | T-02 | whatsNewNoticeProviderがfalse                | SnackBarが表示されない                       |
// | T-03 | SnackBarの「見る」をタップ                   | /whats-new へ遷移する                        |
// | T-04 | childが渡された場合                          | childがそのまま描画される                    |
// | T-05 | whatsNewNoticeProviderがtrue                | SnackBarの表示時間が3秒である                |
//
// NOTE: 「whatsNewNoticeProvider自体が失敗する」ケースはproviderの設計上
// 発生しない（[whatsNewNoticeProvider]は内部でtry/catchしてbool以外を
// 返さないため）。そのケース（NFR-01: 取得失敗時にお知らせを出さない）は
// `whats_new_notice_provider_test.dart` の [T-01] で検証済み。

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/features/whats_new/application/whats_new_notice_provider.dart';
import 'package:front/features/whats_new/presentation/whats_new_notice_listener.dart';
import 'package:go_router/go_router.dart';

Widget _buildRoutedApp(Future<bool> Function() createNoticeFuture) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) =>
            Scaffold(body: WhatsNewNoticeListener(child: const Text('ホーム画面'))),
      ),
      GoRoute(
        path: '/whats-new',
        builder: (context, state) => const Scaffold(body: Text('更新履歴画面')),
      ),
    ],
  );
  return ProviderScope(
    overrides: [
      whatsNewNoticeProvider.overrideWith((ref) => createNoticeFuture()),
    ],
    child: MaterialApp.router(theme: AppTheme.light(), routerConfig: router),
  );
}

void main() {
  testWidgets('[T-01] whatsNewNoticeProviderがtrue_SnackBarが表示される', (
    tester,
  ) async {
    await tester.pumpWidget(_buildRoutedApp(() async => true));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('新しい更新内容があります'), findsOneWidget);
  });

  testWidgets('[T-02] whatsNewNoticeProviderがfalse_SnackBarが表示されない', (
    tester,
  ) async {
    await tester.pumpWidget(_buildRoutedApp(() async => false));
    await tester.pump();
    await tester.pump();

    expect(find.text('新しい更新内容があります'), findsNothing);
  });

  testWidgets('[T-03] SnackBarの見るをタップ_whats-newへ遷移する', (tester) async {
    await tester.pumpWidget(_buildRoutedApp(() async => true));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    await tester.tap(find.text('見る'));
    await tester.pumpAndSettle();

    expect(find.text('更新履歴画面'), findsOneWidget);
  });

  testWidgets('[T-04] childが渡された場合_そのまま描画される', (tester) async {
    await tester.pumpWidget(_buildRoutedApp(() async => false));
    await tester.pump();

    expect(find.text('ホーム画面'), findsOneWidget);
  });

  testWidgets('[T-05] whatsNewNoticeProviderがtrue_SnackBarの表示時間が3秒である', (
    tester,
  ) async {
    await tester.pumpWidget(_buildRoutedApp(() async => true));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(
      tester.widget<SnackBar>(find.byType(SnackBar)).duration,
      const Duration(seconds: 3),
    );
  });
}
