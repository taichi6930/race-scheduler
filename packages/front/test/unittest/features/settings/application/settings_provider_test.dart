// SettingsNotifier のデシジョンテーブル
//
// | ID   | 操作                                          | 期待                                    |
// | ---- | --------------------------------------------- | ------------------------------------------ |
// | T-01 | 初期状態（未保存）                            | 既定値（通知ON・5分前・重賞/お気に入り通知ON・system・全競技ON） |
// | T-02 | setNotificationLeadMinutes(65)                | 60にクランプされる                       |
// | T-03 | setNotificationLeadMinutes(-5)                | 0にクランプされる                        |
// | T-04 | incrementNotificationLeadMinutes              | 5分増える                                |
// | T-05 | decrementNotificationLeadMinutes              | 5分減る                                  |
// | T-06 | toggleDiscipline(keirin)                      | keirinが無効になる                       |
// | T-07 | toggleDisciplineを2回                         | 元に戻る                                 |
// | T-08 | setThemeMode(dark) 後に別コンテナで再読込     | 永続化された値が復元される                |
// | T-09 | 各設定変更後に別コンテナで再読込               | 永続化された値がすべて復元される          |
// | T-10 | 初期状態（未保存、旅程グループ）              | 既定値（連日許容2日・検索対象180日）       |
// | T-11 | setTripToleranceDays(20)                      | 上限14にクランプされる                    |
// | T-12 | setTripToleranceDays(-1)                      | 下限0にクランプされる                     |
// | T-13 | incrementTripToleranceDays                    | 1日増える                                 |
// | T-14 | decrementTripToleranceDays                    | 1日減る                                   |
// | T-15 | setTripLookaheadDays(1000)                    | 上限365にクランプされる                   |
// | T-16 | setTripLookaheadDays(0)                       | 下限1にクランプされる                     |
// | T-17 | incrementTripLookaheadDays                    | 30日増える                                |
// | T-18 | decrementTripLookaheadDays                    | 30日減る                                  |
// | T-19 | 旅程グループ設定変更後に別コンテナで再読込     | 永続化された値が復元される                |
// | T-20 | 各設定変更後にresetToDefaults                 | 全項目が既定値に戻り、再読込しても既定値のまま |
//
// QSTATE-01: 壊れた永続化値からの復元のデシジョンテーブル
//
// | ID   | 操作                                          | 期待                                        |
// | ---- | --------------------------------------------- | -------------------------------------------- |
// | T-21 | 有効な値と未知の値が混在した状態で永続化      | 例外を投げず、未知の値のみ無視して復元される |
// | T-22 | 未知の値のみが永続化されている状態で復元      | 例外を投げず、全競技ONへフォールバックする   |
//
// QSTATE-10: 最後の1競技のtoggle抑止のデシジョンテーブル
//
// | ID   | 操作                                          | 期待                                        |
// | ---- | --------------------------------------------- | -------------------------------------------- |
// | T-23 | 残り1競技の状態でその競技をtoggle             | 変化しない（空集合にならない）               |

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/race_type.dart';
import 'package:front/features/settings/application/settings_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Future<ProviderContainer> buildContainer() async {
    final prefs = await SharedPreferences.getInstance();
    final container = ProviderContainer(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('SettingsNotifier 初期状態', () {
    test('[T-01] 未保存_既定値が復元される', () async {
      final container = await buildContainer();

      final state = container.read(settingsProvider);

      expect(state.notificationsEnabled, isTrue);
      expect(state.notificationLeadMinutes, 5);
      expect(state.autoNotifySpecifiedGrades, isTrue);
      expect(state.notifyFavorites, isTrue);
      expect(state.themeMode, ThemeMode.system);
      expect(state.googleCalendarSyncEnabled, isFalse);
      expect(state.enabledDisciplines, Discipline.values.toSet());
    });

    test('[T-10] 未保存_旅程グループの既定値が復元される', () async {
      final container = await buildContainer();

      final state = container.read(settingsProvider);

      expect(state.tripToleranceDays, kDefaultTripToleranceDays);
      expect(state.tripLookaheadDays, kDefaultTripLookaheadDays);
    });
  });

  group('通知タイミングのクランプ', () {
    test('[T-02] 65を設定_60にクランプされる', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).setNotificationLeadMinutes(65);

      expect(container.read(settingsProvider).notificationLeadMinutes, 60);
    });

    test('[T-03] -5を設定_0にクランプされる', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).setNotificationLeadMinutes(-5);

      expect(container.read(settingsProvider).notificationLeadMinutes, 0);
    });

    test('[T-04] incrementNotificationLeadMinutes_5分増える', () async {
      final container = await buildContainer();

      container
          .read(settingsProvider.notifier)
          .incrementNotificationLeadMinutes();

      expect(container.read(settingsProvider).notificationLeadMinutes, 10);
    });

    test('[T-05] decrementNotificationLeadMinutes_5分減る', () async {
      final container = await buildContainer();

      container
          .read(settingsProvider.notifier)
          .decrementNotificationLeadMinutes();

      expect(container.read(settingsProvider).notificationLeadMinutes, 0);
    });
  });

  group('旅程グループ・連日の許容日数', () {
    test('[T-11] 20を設定_上限14にクランプされる', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).setTripToleranceDays(20);

      expect(
        container.read(settingsProvider).tripToleranceDays,
        kTripToleranceDaysMax,
      );
    });

    test('[T-12] -1を設定_下限0にクランプされる', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).setTripToleranceDays(-1);

      expect(
        container.read(settingsProvider).tripToleranceDays,
        kTripToleranceDaysMin,
      );
    });

    test('[T-13] incrementTripToleranceDays_1日増える', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).incrementTripToleranceDays();

      expect(
        container.read(settingsProvider).tripToleranceDays,
        kDefaultTripToleranceDays + kTripToleranceDaysStep,
      );
    });

    test('[T-14] decrementTripToleranceDays_1日減る', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).decrementTripToleranceDays();

      expect(
        container.read(settingsProvider).tripToleranceDays,
        kDefaultTripToleranceDays - kTripToleranceDaysStep,
      );
    });
  });

  group('旅程グループ・検索対象期間', () {
    test('[T-15] 1000を設定_上限365にクランプされる', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).setTripLookaheadDays(1000);

      expect(
        container.read(settingsProvider).tripLookaheadDays,
        kTripLookaheadDaysMax,
      );
    });

    test('[T-16] 0を設定_下限1にクランプされる', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).setTripLookaheadDays(0);

      expect(
        container.read(settingsProvider).tripLookaheadDays,
        kTripLookaheadDaysMin,
      );
    });

    test('[T-17] incrementTripLookaheadDays_30日増える', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).incrementTripLookaheadDays();

      expect(
        container.read(settingsProvider).tripLookaheadDays,
        kDefaultTripLookaheadDays + kTripLookaheadDaysStep,
      );
    });

    test('[T-18] decrementTripLookaheadDays_30日減る', () async {
      final container = await buildContainer();

      container.read(settingsProvider.notifier).decrementTripLookaheadDays();

      expect(
        container.read(settingsProvider).tripLookaheadDays,
        kDefaultTripLookaheadDays - kTripLookaheadDaysStep,
      );
    });
  });

  group('対象の公営競技', () {
    test('[T-06] toggleDiscipline(keirin)_keirinが無効になる', () async {
      final container = await buildContainer();

      container
          .read(settingsProvider.notifier)
          .toggleDiscipline(Discipline.keirin);

      expect(
        container.read(settingsProvider).enabledDisciplines,
        isNot(contains(Discipline.keirin)),
      );
    });

    test('[T-07] toggleDisciplineを2回_元に戻る', () async {
      final container = await buildContainer();
      final notifier = container.read(settingsProvider.notifier);

      notifier.toggleDiscipline(Discipline.keirin);
      notifier.toggleDiscipline(Discipline.keirin);

      expect(
        container.read(settingsProvider).enabledDisciplines,
        contains(Discipline.keirin),
      );
    });

    test('[T-23] 残り1競技の状態でその競技をtoggle_変化しない', () async {
      final container = await buildContainer();
      final notifier = container.read(settingsProvider.notifier);
      // keiba以外の3競技を先にOFFにし、残り1競技（keiba）の状態を作る。
      notifier.toggleDiscipline(Discipline.keirin);
      notifier.toggleDiscipline(Discipline.boatrace);
      notifier.toggleDiscipline(Discipline.autorace);
      expect(container.read(settingsProvider).enabledDisciplines, {
        Discipline.keiba,
      });

      notifier.toggleDiscipline(Discipline.keiba);

      expect(container.read(settingsProvider).enabledDisciplines, {
        Discipline.keiba,
      });
    });
  });

  group('QSTATE-01: 壊れた永続化値からの復元', () {
    test('[T-21] 有効な値と未知の値が混在_未知の値のみ無視して復元される', () async {
      SharedPreferences.setMockInitialValues({
        'settings_enabled_disciplines': ['keirin', 'unknown_discipline'],
      });

      final container = await buildContainer();

      expect(() => container.read(settingsProvider), returnsNormally);
      expect(container.read(settingsProvider).enabledDisciplines, {
        Discipline.keirin,
      });
    });

    test('[T-22] 未知の値のみが永続化_例外を投げず全競技ONへフォールバックする', () async {
      SharedPreferences.setMockInitialValues({
        'settings_enabled_disciplines': ['unknown_discipline'],
      });

      final container = await buildContainer();

      expect(() => container.read(settingsProvider), returnsNormally);
      expect(
        container.read(settingsProvider).enabledDisciplines,
        Discipline.values.toSet(),
      );
    });
  });

  group('永続化', () {
    test('[T-08] setThemeMode(dark)後に別コンテナで再読込_darkが復元される', () async {
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      first.read(settingsProvider.notifier).setThemeMode(ThemeMode.dark);
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);

      expect(second.read(settingsProvider).themeMode, ThemeMode.dark);
    });

    test('[T-09] 各設定変更後に別コンテナで再読込_すべて復元される', () async {
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      final firstNotifier = first.read(settingsProvider.notifier);
      firstNotifier.setNotificationsEnabled(false);
      firstNotifier.setNotificationLeadMinutes(15);
      firstNotifier.setAutoNotifySpecifiedGrades(false);
      firstNotifier.setNotifyFavorites(false);
      firstNotifier.setGoogleCalendarSyncEnabled(true);
      firstNotifier.toggleDiscipline(Discipline.autorace);
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);
      final state = second.read(settingsProvider);

      expect(state.notificationsEnabled, isFalse);
      expect(state.notificationLeadMinutes, 15);
      expect(state.autoNotifySpecifiedGrades, isFalse);
      expect(state.notifyFavorites, isFalse);
      expect(state.googleCalendarSyncEnabled, isTrue);
      expect(state.enabledDisciplines, isNot(contains(Discipline.autorace)));
    });

    test('[T-19] 旅程グループ設定変更後に別コンテナで再読込_復元される', () async {
      final prefs = await SharedPreferences.getInstance();
      final first = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      final firstNotifier = first.read(settingsProvider.notifier);
      firstNotifier.setTripToleranceDays(5);
      firstNotifier.setTripLookaheadDays(60);
      first.dispose();

      final second = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(second.dispose);
      final state = second.read(settingsProvider);

      expect(state.tripToleranceDays, 5);
      expect(state.tripLookaheadDays, 60);
    });

    test('[T-20] 各設定変更後にresetToDefaults_全項目が既定値に戻り再読込しても既定値のまま', () async {
      final prefs = await SharedPreferences.getInstance();
      final container = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(container.dispose);
      final notifier = container.read(settingsProvider.notifier);
      notifier.setNotificationsEnabled(false);
      notifier.setNotificationLeadMinutes(15);
      notifier.setAutoNotifySpecifiedGrades(false);
      notifier.setNotifyFavorites(false);
      notifier.setThemeMode(ThemeMode.dark);
      notifier.setGoogleCalendarSyncEnabled(true);
      notifier.toggleDiscipline(Discipline.autorace);
      notifier.setTripToleranceDays(5);
      notifier.setTripLookaheadDays(60);

      final succeeded = await notifier.resetToDefaults();

      expect(succeeded, isTrue);
      final state = container.read(settingsProvider);
      expect(state.notificationsEnabled, isTrue);
      expect(state.notificationLeadMinutes, 5);
      expect(state.autoNotifySpecifiedGrades, isTrue);
      expect(state.notifyFavorites, isTrue);
      expect(state.themeMode, ThemeMode.system);
      expect(state.googleCalendarSyncEnabled, isFalse);
      expect(state.enabledDisciplines, Discipline.values.toSet());
      expect(state.tripToleranceDays, 2);
      expect(state.tripLookaheadDays, 180);

      final reloaded = ProviderContainer(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
      );
      addTearDown(reloaded.dispose);
      final reloadedState = reloaded.read(settingsProvider);
      expect(reloadedState.notificationsEnabled, isTrue);
      expect(reloadedState.tripToleranceDays, 2);
    });
  });
}
