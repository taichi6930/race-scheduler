// コンポーネントテスト: タイムライン→詳細シート→カレンダー追加という、
// 複数の画面/コンポーネントをまたぐ操作フロー全体の検証（BEHAV-049）。
//
// TimelineScreen（実画面）→レース行タップ→RaceDetailSheet（実ウィジェット）が
// ボトムシートとして起動→「カレンダー追加」→「Googleカレンダー」選択、という
// 一連の流れを1本のテストとして検証する。各ステップ単体は
// timeline_screen_test.dart / race_detail_sheet_test.dart で個別に
// カバー済みだが、画面をまたいだ状態引き継ぎ（レース選択→シートに渡る
// RaceEntity・カレンダーURL生成まで）が壊れていないことは、
// このような結合したテストでのみ検知できる。

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/design/theme.dart';
import 'package:front/design/organisms/race_row.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/timeline/application/all_timeline_provider.dart';
import 'package:front/features/timeline/application/now_provider.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';
import 'package:front/features/timeline/presentation/race_detail_sheet.dart';
import 'package:front/features/timeline/presentation/timeline_screen.dart';
import 'package:front/notifications/application/notification_scheduler_provider.dart';
import 'package:front/notifications/i_notification_scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

class _FakeNotificationScheduler implements INotificationScheduler {
  @override
  Future<void> initialize() async {}

  @override
  Future<void> scheduleRaceNotification(
    RaceEntity race, {
    required int leadMinutes,
  }) async {}

  @override
  Future<void> cancelRaceNotification(String raceId) async {}

  @override
  Future<void> cancelAll() async {}
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

final _fixedNow = DateTime(2026, 4, 19, 15, 35);

final _race = RaceEntity(
  raceId: 'race-001',
  raceName: '皐月賞',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: _fixedNow.add(const Duration(minutes: 10)).toIso8601String(),
  raceGrade: 'GⅠ',
  raceNumber: 11,
);

void main() {
  testWidgets('タイムライン→詳細シート→カレンダー追加の一連の操作フローが完走すること', (tester) async {
    // KPLAYER-07: timelineFilterProviderの初回移行（既定値をgradeOnly/
    // favoriteOnly両方ONへ強制上書き）は、フィルタなし前提のこのテスト
    // （単一のGⅠレースをそのままRaceRowとして見つける）と衝突するため、
    // 移行済み・旧デフォルト値（両方OFF）として明示的に固定する。
    SharedPreferences.setMockInitialValues({
      'timeline_filter_default_migration_v2': true,
      'timeline_filter_grade_only': false,
      'timeline_filter_favorite_only': false,
      // QEMP-05: スワイプヒントバーが表示されると縦方向のスペースを消費し、
      // 800x600のテストビューポート内でRaceRowが折り返し境界外に押し出され
      // タップがヒットしなくなる（timeline_screen_test.dartと同じ対処）。
      'timeline_swipe_hint_seen': true,
    });
    final prefs = await SharedPreferences.getInstance();
    final fake = _FakeUrlLauncher(result: true);
    UrlLauncherPlatform.instance = fake;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          timelineProvider.overrideWith((ref, date) async => [_race]),
          monthRaceChunkProvider.overrideWith((ref, monthKey) async => [_race]),
          notificationSchedulerProvider.overrideWithValue(
            _FakeNotificationScheduler(),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const TimelineScreen(),
        ),
      ),
    );
    await tester.pump();

    // タイムライン画面 → レース行タップ
    expect(find.byType(RaceDetailContent), findsNothing);
    await tester.tap(
      find.descendant(of: find.byType(RaceRow), matching: find.text('皐月賞')),
    );
    await tester.pumpAndSettle();

    // 詳細シートが起動する
    expect(find.byType(RaceDetailContent), findsOneWidget);

    // 詳細シート → カレンダー追加 → Googleカレンダー
    await tester.tap(find.text('カレンダー追加'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Googleカレンダー'));
    await tester.pumpAndSettle();

    expect(fake.lastLaunchedUrl, isNotNull);
    expect(fake.lastLaunchedUrl, contains('calendar.google.com'));
    expect(find.byType(SnackBar), findsNothing);
  });
}
