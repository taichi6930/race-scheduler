// AnnouncementBannerListener のデシジョンテーブル
//
// | ID   | 条件                                          | 期待                                          |
// | ---- | ------------------------------------------------ | ------------------------------------------------ |
// | T-01 | announcementProviderがAnnouncement（enabled想定） | SnackBarでmessageが表示される                 |
// | T-02 | announcementProviderがnull                       | SnackBarが表示されない                        |
// | T-03 | actionLabel/actionUrl無し                        | SnackBarにアクションボタンが表示されない      |
// | T-04 | childが渡された場合                              | childがそのまま描画される                     |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/design/theme.dart';
import 'package:front/domain/entities/announcement.dart';
import 'package:front/features/announcement/application/announcement_provider.dart';
import 'package:front/features/announcement/presentation/announcement_banner_listener.dart';

Widget _buildApp(Future<Announcement?> Function() createAnnouncementFuture) {
  return ProviderScope(
    overrides: [
      announcementProvider.overrideWith((ref) => createAnnouncementFuture()),
    ],
    child: MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: AnnouncementBannerListener(child: const Text('ホーム画面')),
      ),
    ),
  );
}

void main() {
  testWidgets('[T-01] announcementProviderがAnnouncementの場合_SnackBarが表示される', (
    tester,
  ) async {
    await tester.pumpWidget(
      _buildApp(
        () async =>
            const Announcement(enabled: true, message: 'お知らせがあります'),
      ),
    );
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('お知らせがあります'), findsOneWidget);
  });

  testWidgets('[T-02] announcementProviderがnullの場合_SnackBarが表示されない', (
    tester,
  ) async {
    await tester.pumpWidget(_buildApp(() async => null));
    await tester.pump();
    await tester.pump();

    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('[T-03] actionLabel_actionUrl無しの場合_アクションボタンが表示されない', (
    tester,
  ) async {
    await tester.pumpWidget(
      _buildApp(() async => const Announcement(enabled: true, message: 'a')),
    );
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(SnackBarAction), findsNothing);
  });

  testWidgets('[T-04] childが渡された場合_そのまま描画される', (tester) async {
    await tester.pumpWidget(_buildApp(() async => null));
    await tester.pump();

    expect(find.text('ホーム画面'), findsOneWidget);
  });
}
