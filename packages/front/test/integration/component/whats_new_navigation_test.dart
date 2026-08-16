// コンポーネントテスト: SettingsScreen → WhatsNewScreen の画面横断ナビゲーション
// 検証（FR-03、`trip_groups_navigation_test.dart` と同型）。
//
// 設定画面の「更新履歴」行タップで実際の GoRouter を介して更新履歴画面
// （スタブではなく本物の WhatsNewScreen）へ遷移し、リリース内容が正しく
// 表示されることを検証する。

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/organisms/settings_rows.dart';
import 'package:front/domain/entities/release_note_category.dart';
import 'package:front/domain/entities/release_note_entity.dart';
import 'package:front/features/settings/presentation/settings_screen.dart';
import 'package:front/features/whats_new/application/release_notes_provider.dart';
import 'package:front/features/whats_new/presentation/whats_new_screen.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<Widget> _buildRoutedApp(List<ReleaseNoteEntity> releases) async {
  final prefs = await SharedPreferences.getInstance();
  final router = GoRouter(
    initialLocation: '/settings',
    routes: [
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/whats-new',
        builder: (context, state) => const WhatsNewScreen(),
      ),
    ],
  );
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      releaseNotesProvider.overrideWith((ref) async => releases),
    ],
    child: MaterialApp.router(theme: AppTheme.light(), routerConfig: router),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('更新履歴行をタップ_実際の更新履歴画面へ遷移しリリース内容が表示される', (tester) async {
    final releases = [
      ReleaseNoteEntity(
        tagName: 'v1.2.0',
        publishedAt: DateTime(2026, 8, 1),
        categories: const [
          ReleaseNoteCategoryEntryEntity(
            category: ReleaseNoteCategory.frontend,
            items: ['更新履歴ページを追加しました'],
          ),
        ],
      ),
    ];
    await tester.pumpWidget(await _buildRoutedApp(releases));
    await tester.pump();

    await tester.dragUntilVisible(
      find.text('更新履歴'),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.pump();
    await tester.tap(
      find.descendant(
        of: find.ancestor(
          of: find.text('更新履歴'),
          matching: find.byType(SettingsActionRow),
        ),
        matching: find.text('開く'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.widgetWithText(AppBar, '更新履歴'), findsOneWidget);
    expect(find.text('v1.2.0'), findsOneWidget);
    expect(find.text('• 更新履歴ページを追加しました'), findsOneWidget);
  });
}
