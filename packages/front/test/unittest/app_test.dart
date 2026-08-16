// MyApp（アプリのルート）のデシジョンテーブル
//
// | ID   | 条件                                                          | 期待                                             |
// | ---- | ------------------------------------------------------------- | ------------------------------------------------ |
// | T-01 | お気に入り登録済みレースがある状態で起動                      | 既定のleadMinutesでscheduleRaceNotificationが呼ばれる |
// | T-02 | 起動後に「通知タイミング」設定を変更（QSET-09）                | レース内容は変わらないが、新しいleadMinutesで再度scheduleRaceNotificationが呼ばれる |
// | T-03 | 起動（QWEB-02）                                                | ロケールが日本語（ja）で解決される               |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/app.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/notification_settings.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/favorites/application/favorite_ids_provider.dart';
import 'package:front/features/favorites/application/favorite_races_provider.dart';
import 'package:front/features/settings/application/settings_provider.dart';
import 'package:front/features/timeline/application/now_provider.dart';
import 'package:front/notifications/application/notification_scheduler_provider.dart';
import 'package:front/notifications/i_notification_scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _fixedNow = DateTime(2026, 8, 9, 10);

RaceEntity _race({required String id, required Duration offsetFromNow}) =>
    RaceEntity(
      raceId: id,
      raceName: 'テストレース',
      raceType: 'jra',
      placeId: 'tokyo',
      raceCourse: '東京',
      datetime: _fixedNow.add(offsetFromNow).toIso8601String(),
      raceNumber: 1,
    );

/// [scheduleRaceNotification] の呼び出し履歴（race, leadMinutes）を記録する
/// フェイクスケジューラ（QSET-09の回帰テスト用）。
class _RecordingNotificationScheduler implements INotificationScheduler {
  final calls = <(RaceEntity, int)>[];

  @override
  Future<void> initialize() async {}

  @override
  Future<void> scheduleRaceNotification(
    RaceEntity race, {
    required int leadMinutes,
  }) async {
    calls.add((race, leadMinutes));
  }

  @override
  Future<void> cancelRaceNotification(String raceId) async {}

  @override
  Future<void> cancelAll() async {}
}

Future<SharedPreferences> _mockPrefs() async {
  SharedPreferences.setMockInitialValues({});
  return SharedPreferences.getInstance();
}

class _FixedFavoriteIdsNotifier extends FavoriteIdsNotifier {
  _FixedFavoriteIdsNotifier(this._initial);

  final Set<String> _initial;

  @override
  Set<String> build() => _initial;
}

void main() {
  testWidgets('[T-01] お気に入り登録済みレースがある状態で起動_既定のleadMinutesで通知登録される', (
    tester,
  ) async {
    final scheduler = _RecordingNotificationScheduler();
    final race = _race(id: 'r1', offsetFromNow: const Duration(minutes: 30));
    final prefs = await _mockPrefs();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteIdsProvider.overrideWith(
            () => _FixedFavoriteIdsNotifier({race.raceId}),
          ),
          favoriteRacesRawProvider.overrideWith((ref) async => [race]),
          notificationSchedulerProvider.overrideWithValue(scheduler),
        ],
        child: const MyApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(scheduler.calls, hasLength(1));
    expect(scheduler.calls.single.$1.raceId, 'r1');
    expect(scheduler.calls.single.$2, kDefaultNotificationLeadMinutes);
  });

  testWidgets('[T-02] 起動後に通知タイミングを変更_新しいleadMinutesで再度登録される', (tester) async {
    final scheduler = _RecordingNotificationScheduler();
    final race = _race(id: 'r1', offsetFromNow: const Duration(minutes: 30));
    final prefs = await _mockPrefs();

    late WidgetRef capturedRef;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteIdsProvider.overrideWith(
            () => _FixedFavoriteIdsNotifier({race.raceId}),
          ),
          favoriteRacesRawProvider.overrideWith((ref) async => [race]),
          notificationSchedulerProvider.overrideWithValue(scheduler),
        ],
        child: Consumer(
          builder: (context, ref, _) {
            capturedRef = ref;
            return const MyApp();
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(scheduler.calls, hasLength(1));

    capturedRef
        .read(settingsProvider.notifier)
        .incrementNotificationLeadMinutes();
    await tester.pumpAndSettle();

    expect(scheduler.calls, hasLength(2));
    expect(scheduler.calls.last.$1.raceId, 'r1');
    expect(
      scheduler.calls.last.$2,
      kDefaultNotificationLeadMinutes + kNotificationLeadMinutesStep,
    );
  });

  testWidgets('[T-03] 起動_ロケールが日本語で解決される', (tester) async {
    final scheduler = _RecordingNotificationScheduler();
    final race = _race(id: 'r1', offsetFromNow: const Duration(minutes: 30));
    final prefs = await _mockPrefs();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          nowProvider.overrideWith((ref) => Stream.value(_fixedNow)),
          favoriteIdsProvider.overrideWith(
            () => _FixedFavoriteIdsNotifier({race.raceId}),
          ),
          favoriteRacesRawProvider.overrideWith((ref) async => [race]),
          notificationSchedulerProvider.overrideWithValue(scheduler),
        ],
        child: const MyApp(),
      ),
    );
    await tester.pumpAndSettle();

    // Scaffold（AppShell配下、MaterialApp.routerが提供するLocalizationsの
    // 子孫）のcontextから実際に解決されたロケールを確認する。
    final context = tester.element(find.byType(Scaffold).first);
    expect(Localizations.localeOf(context), const Locale('ja'));
  });
}
