// WhatsNewScreen のデシジョンテーブル
//
// | ID   | 条件                                        | 期待                                          |
// | ---- | -------------------------------------------- | ---------------------------------------------- |
// | T-01 | カテゴリ付きリリースが1件                   | バージョン・カテゴリラベル・箇条書きが表示される |
// | T-02 | 複数リリース                                 | 新しい順（先頭）で表示される                 |
// | T-03 | カテゴリが空のリリースのみ                   | EmptyStateが表示される                       |
// | T-04 | ローディング中                               | LoadingSkeletonListが表示される              |
// | T-05 | エラー                                       | ErrorRetryCardが表示され、再試行で再取得する |
// | T-06 | 更新ボタンをタップ                           | releaseNotesProviderが再取得される           |
// | T-07 | データ取得成功                               | lastSeenReleaseTagProviderが最新タグに更新される |
// | T-08 | 空状態（QEMP-08）でリンクをタップ            | GitHubのリリースページのURLでlaunchUrlが呼ばれる |

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/molecules/error_retry_card.dart';
import 'package:front/design/molecules/loading_skeleton_list.dart';
import 'package:front/domain/entities/release_note_category.dart';
import 'package:front/domain/entities/release_note_entity.dart';
import 'package:front/features/whats_new/application/last_seen_release_provider.dart';
import 'package:front/features/whats_new/application/release_notes_provider.dart';
import 'package:front/features/whats_new/presentation/whats_new_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

ReleaseNoteEntity _release(
  String tagName,
  DateTime publishedAt, {
  List<ReleaseNoteCategoryEntryEntity> categories = const [
    ReleaseNoteCategoryEntryEntity(
      category: ReleaseNoteCategory.improvement,
      items: ['通知の重複を解消しました'],
    ),
  ],
}) => ReleaseNoteEntity(
  tagName: tagName,
  publishedAt: publishedAt,
  categories: categories,
);

Future<Widget> _buildApp(
  Future<List<ReleaseNoteEntity>> Function() createReleasesFuture,
) async {
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      releaseNotesProvider.overrideWith((ref) => createReleasesFuture()),
    ],
    child: MaterialApp(theme: AppTheme.light(), home: const WhatsNewScreen()),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('[T-01] カテゴリ付きリリースが1件_バージョン・カテゴリ・箇条書きが表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(() async => [_release('v1.2.0', DateTime(2026, 8, 1))]),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('v1.2.0'), findsOneWidget);
    expect(find.text('2026年8月1日'), findsOneWidget);
    expect(find.text('改善'), findsOneWidget);
    expect(find.text('• 通知の重複を解消しました'), findsOneWidget);
  });

  testWidgets('[T-02] 複数リリース_新しい順で表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        () async => [
          _release('v1.2.0', DateTime(2026, 8, 1)),
          _release('v1.1.0', DateTime(2026, 7, 1)),
        ],
      ),
    );
    await tester.pump();
    await tester.pump();

    final v120 = tester.getTopLeft(find.text('v1.2.0'));
    final v110 = tester.getTopLeft(find.text('v1.1.0'));
    expect(v120.dy, lessThan(v110.dy));
  });

  testWidgets('[T-03] カテゴリが空のリリースのみ_EmptyStateが表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        () async => [
          _release('v1.0.0', DateTime(2026, 6, 1), categories: const []),
        ],
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.textContaining('更新履歴がありません'), findsOneWidget);
  });

  testWidgets('[T-04] ローディング中_LoadingSkeletonListが表示される', (tester) async {
    await tester.pumpWidget(
      await _buildApp(() => Completer<List<ReleaseNoteEntity>>().future),
    );
    await tester.pump();

    expect(find.byType(LoadingSkeletonList), findsOneWidget);
  });

  testWidgets('[T-05] エラー_ErrorRetryCardが表示される', (tester) async {
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        retry: (retryCount, error) => null,
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          releaseNotesProvider.overrideWith(
            (ref) => Future<List<ReleaseNoteEntity>>.error(Exception('failed')),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const WhatsNewScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byType(ErrorRetryCard), findsOneWidget);
    expect(find.text('更新履歴の取得に失敗しました'), findsOneWidget);
  });

  testWidgets('[T-06] 更新ボタンをタップ_releaseNotesProviderが再取得される', (tester) async {
    var callCount = 0;
    await tester.pumpWidget(
      await _buildApp(() async {
        callCount++;
        return <ReleaseNoteEntity>[];
      }),
    );
    await tester.pump();
    await tester.pump();
    expect(callCount, 1);

    await tester.tap(find.byIcon(Icons.refresh));
    await tester.pump();
    await tester.pump();

    expect(callCount, 2);
  });

  testWidgets('[T-07] データ取得成功_lastSeenReleaseTagProviderが最新タグに更新される', (
    tester,
  ) async {
    late WidgetRef capturedRef;
    final prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          releaseNotesProvider.overrideWith(
            (ref) async => [_release('v1.2.0', DateTime(2026, 8, 1))],
          ),
        ],
        child: Consumer(
          builder: (context, ref, _) {
            capturedRef = ref;
            return MaterialApp(
              theme: AppTheme.light(),
              home: const WhatsNewScreen(),
            );
          },
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(capturedRef.read(lastSeenReleaseTagProvider), 'v1.2.0');
  });

  testWidgets('[T-08] 空状態でリンクをタップ_GitHubのリリースページのURLでlaunchUrlが呼ばれる', (
    tester,
  ) async {
    final fake = _FakeUrlLauncher(result: true);
    UrlLauncherPlatform.instance = fake;

    await tester.pumpWidget(await _buildApp(() async => []));
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('GitHubのリリースページを開く'));
    await tester.pump();

    expect(
      fake.lastLaunchedUrl,
      'https://github.com/taichi6930/race-scheduler/releases',
    );
  });
}

class _FakeUrlLauncher extends UrlLauncherPlatform {
  _FakeUrlLauncher({required this.result});

  final bool result;
  String? lastLaunchedUrl;

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    lastLaunchedUrl = url;
    return result;
  }
}
