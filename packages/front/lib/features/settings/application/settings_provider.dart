import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/di/shared_preferences_provider.dart';
import '../../../core/persist_write.dart';
import '../../../domain/entities/notification_settings.dart';
import '../../../domain/entities/race_type.dart';

const _kNotificationsEnabled = 'settings_notifications_enabled';
const _kNotificationLeadMinutes = 'settings_notification_lead_minutes';
const _kAutoNotifySpecifiedGrades = 'settings_auto_notify_specified_grades';
const _kNotifyFavorites = 'settings_notify_favorites';
const _kThemeMode = 'settings_theme_mode';
const _kGoogleCalendarSyncEnabled = 'settings_google_calendar_sync_enabled';
const _kEnabledDisciplines = 'settings_enabled_disciplines';
const _kTripToleranceDays = 'settings_trip_tolerance_days';
const _kTripLookaheadDays = 'settings_trip_lookahead_days';

/// 通知タイミングの下限・上限・刻み幅（screens.md §5-1: 0〜60分・5分刻み）。
const int kNotificationLeadMinutesMin = 0;
const int kNotificationLeadMinutesMax = 60;
const int kNotificationLeadMinutesStep = 5;

/// 旅程グループ「連日」許容日数の既定値・下限・上限・刻み幅
/// （`docs/specs/SPEC-TRIP-001.md` の既定値2日に対応）。
const int kDefaultTripToleranceDays = 2;
const int kTripToleranceDaysMin = 0;
const int kTripToleranceDaysMax = 14;
const int kTripToleranceDaysStep = 1;

/// 旅程グループ検索対象期間（今日から何日先まで）の既定値・下限・上限・刻み幅
/// （`docs/specs/SPEC-TRIP-001.md` の既定値180日に対応）。
const int kDefaultTripLookaheadDays = 180;
const int kTripLookaheadDaysMin = 1;
const int kTripLookaheadDaysMax = 365;
const int kTripLookaheadDaysStep = 30;

/// 設定画面の状態（screens.md §5）。
class SettingsState {
  const SettingsState({
    required this.notificationsEnabled,
    required this.notificationLeadMinutes,
    required this.autoNotifySpecifiedGrades,
    required this.notifyFavorites,
    required this.themeMode,
    required this.googleCalendarSyncEnabled,
    required this.enabledDisciplines,
    required this.tripToleranceDays,
    required this.tripLookaheadDays,
  });

  /// 通知を受け取る（マスタートグル）。
  final bool notificationsEnabled;

  /// 発走の何分前に通知するか（既定 [kDefaultNotificationLeadMinutes]）。
  final int notificationLeadMinutes;

  /// 重賞（isSpecified=true）は登録不要で自動通知対象にする。
  final bool autoNotifySpecifiedGrades;

  /// お気に入り登録レースを通知対象にする。
  final bool notifyFavorites;

  final ThemeMode themeMode;

  /// Google カレンダー連携（MVPではUIのみ、実装は将来）。
  final bool googleCalendarSyncEnabled;

  /// 対象の公営競技（タイムラインのフィルタ既定値と連動、永続化）。
  final Set<Discipline> enabledDisciplines;

  /// 旅程グループ候補日検出の「連日」許容日数（既定 [kDefaultTripToleranceDays]）。
  final int tripToleranceDays;

  /// 旅程グループ候補日検出の検索対象期間・今日から何日先まで
  /// （既定 [kDefaultTripLookaheadDays]）。
  final int tripLookaheadDays;

  SettingsState copyWith({
    bool? notificationsEnabled,
    int? notificationLeadMinutes,
    bool? autoNotifySpecifiedGrades,
    bool? notifyFavorites,
    ThemeMode? themeMode,
    bool? googleCalendarSyncEnabled,
    Set<Discipline>? enabledDisciplines,
    int? tripToleranceDays,
    int? tripLookaheadDays,
  }) {
    return SettingsState(
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      notificationLeadMinutes:
          notificationLeadMinutes ?? this.notificationLeadMinutes,
      autoNotifySpecifiedGrades:
          autoNotifySpecifiedGrades ?? this.autoNotifySpecifiedGrades,
      notifyFavorites: notifyFavorites ?? this.notifyFavorites,
      themeMode: themeMode ?? this.themeMode,
      googleCalendarSyncEnabled:
          googleCalendarSyncEnabled ?? this.googleCalendarSyncEnabled,
      enabledDisciplines: enabledDisciplines ?? this.enabledDisciplines,
      tripToleranceDays: tripToleranceDays ?? this.tripToleranceDays,
      tripLookaheadDays: tripLookaheadDays ?? this.tripLookaheadDays,
    );
  }
}

/// 保存済みの index から [ThemeMode] を復元する。範囲外・未保存は `system`。
ThemeMode _themeModeFromIndex(int? index) {
  if (index == null || index < 0 || index >= ThemeMode.values.length) {
    return ThemeMode.system;
  }
  return ThemeMode.values[index];
}

/// アプリ全体の設定（通知lead分・テーマ・対象競技トグル）。
/// `shared_preferences` に永続化する（旧 `theme_provider.dart` を統合）。
final settingsProvider = NotifierProvider<SettingsNotifier, SettingsState>(
  SettingsNotifier.new,
);

class SettingsNotifier extends Notifier<SettingsState> {
  SharedPreferences get _prefs => ref.read(sharedPreferencesProvider);

  @override
  SettingsState build() {
    final prefs = ref.read(sharedPreferencesProvider);
    final disciplineValues = prefs.getStringList(_kEnabledDisciplines);
    // QSTATE-01: 未知の値（将来のenum名変更等で残った壊れた値）は
    // Discipline.fromValue だと ArgumentError を送出し、build() が毎起動時に
    // 呼ばれる都合上アプリが二度と起動できなくなってしまうため、
    // timeline_filter_provider.dart の _decodeGradeTiers 等と同じく
    // 未知値は無視する。フィルタ後に1件も残らない場合（全滅）も、
    // enabledDisciplines が空集合のままだと画面が常に0件になり
    // 気づけなくなるため、全競技ONへフォールバックする。
    final decodedDisciplines = disciplineValues
        ?.map(Discipline.fromValueOrNull)
        .whereType<Discipline>()
        .toSet();
    return SettingsState(
      notificationsEnabled: prefs.getBool(_kNotificationsEnabled) ?? true,
      notificationLeadMinutes:
          prefs.getInt(_kNotificationLeadMinutes) ??
          kDefaultNotificationLeadMinutes,
      autoNotifySpecifiedGrades:
          prefs.getBool(_kAutoNotifySpecifiedGrades) ?? true,
      notifyFavorites: prefs.getBool(_kNotifyFavorites) ?? true,
      themeMode: _themeModeFromIndex(prefs.getInt(_kThemeMode)),
      googleCalendarSyncEnabled:
          prefs.getBool(_kGoogleCalendarSyncEnabled) ?? false,
      enabledDisciplines:
          (decodedDisciplines == null || decodedDisciplines.isEmpty)
          ? {...Discipline.all}
          : decodedDisciplines,
      tripToleranceDays:
          prefs.getInt(_kTripToleranceDays) ?? kDefaultTripToleranceDays,
      tripLookaheadDays:
          prefs.getInt(_kTripLookaheadDays) ?? kDefaultTripLookaheadDays,
    );
  }

  /// 変更を永続化し、成功したかどうかを返す（FEDGE-04:
  /// UI側が失敗を検知して成功SnackBarの代わりにエラー表示できるようにする）。
  Future<bool> setNotificationsEnabled(bool value) {
    state = state.copyWith(notificationsEnabled: value);
    return persistWrite(() => _prefs.setBool(_kNotificationsEnabled, value));
  }

  /// 通知タイミングを [kNotificationLeadMinutesMin]〜[kNotificationLeadMinutesMax]
  /// の範囲にクランプして設定する。
  void setNotificationLeadMinutes(int minutes) {
    final clamped = minutes.clamp(
      kNotificationLeadMinutesMin,
      kNotificationLeadMinutesMax,
    );
    state = state.copyWith(notificationLeadMinutes: clamped);
    unawaited(
      persistWrite(() => _prefs.setInt(_kNotificationLeadMinutes, clamped)),
    );
  }

  void incrementNotificationLeadMinutes() => setNotificationLeadMinutes(
    state.notificationLeadMinutes + kNotificationLeadMinutesStep,
  );

  void decrementNotificationLeadMinutes() => setNotificationLeadMinutes(
    state.notificationLeadMinutes - kNotificationLeadMinutesStep,
  );

  Future<bool> setAutoNotifySpecifiedGrades(bool value) {
    state = state.copyWith(autoNotifySpecifiedGrades: value);
    return persistWrite(
      () => _prefs.setBool(_kAutoNotifySpecifiedGrades, value),
    );
  }

  Future<bool> setNotifyFavorites(bool value) {
    state = state.copyWith(notifyFavorites: value);
    return persistWrite(() => _prefs.setBool(_kNotifyFavorites, value));
  }

  void setThemeMode(ThemeMode mode) {
    state = state.copyWith(themeMode: mode);
    unawaited(persistWrite(() => _prefs.setInt(_kThemeMode, mode.index)));
  }

  Future<bool> setGoogleCalendarSyncEnabled(bool value) {
    state = state.copyWith(googleCalendarSyncEnabled: value);
    return persistWrite(
      () => _prefs.setBool(_kGoogleCalendarSyncEnabled, value),
    );
  }

  /// 対象の公営競技を切り替える（タイムラインの競技フィルタと連動・永続化）。
  ///
  /// QSTATE-10: 最後の1競技をOFFにする呼び出しは無視する（空集合になると
  /// タイムラインが常に0件になり、原因が画面上に説明されないまま気づけない
  /// ため）。
  void toggleDiscipline(Discipline discipline) {
    final updated = Set<Discipline>.from(state.enabledDisciplines);
    if (!updated.remove(discipline)) {
      updated.add(discipline);
    } else if (updated.isEmpty) {
      return;
    }
    state = state.copyWith(enabledDisciplines: updated);
    unawaited(
      persistWrite(
        () => _prefs.setStringList(
          _kEnabledDisciplines,
          updated.map((t) => t.value).toList(),
        ),
      ),
    );
  }

  /// 旅程グループの「連日」許容日数を [kTripToleranceDaysMin]〜
  /// [kTripToleranceDaysMax] の範囲にクランプして設定する。
  void setTripToleranceDays(int days) {
    final clamped = days.clamp(kTripToleranceDaysMin, kTripToleranceDaysMax);
    state = state.copyWith(tripToleranceDays: clamped);
    unawaited(persistWrite(() => _prefs.setInt(_kTripToleranceDays, clamped)));
  }

  void incrementTripToleranceDays() =>
      setTripToleranceDays(state.tripToleranceDays + kTripToleranceDaysStep);

  void decrementTripToleranceDays() =>
      setTripToleranceDays(state.tripToleranceDays - kTripToleranceDaysStep);

  /// 旅程グループの検索対象期間（日数）を [kTripLookaheadDaysMin]〜
  /// [kTripLookaheadDaysMax] の範囲にクランプして設定する。
  void setTripLookaheadDays(int days) {
    final clamped = days.clamp(kTripLookaheadDaysMin, kTripLookaheadDaysMax);
    state = state.copyWith(tripLookaheadDays: clamped);
    unawaited(persistWrite(() => _prefs.setInt(_kTripLookaheadDays, clamped)));
  }

  void incrementTripLookaheadDays() =>
      setTripLookaheadDays(state.tripLookaheadDays + kTripLookaheadDaysStep);

  void decrementTripLookaheadDays() =>
      setTripLookaheadDays(state.tripLookaheadDays - kTripLookaheadDaysStep);

  /// この設定画面が持つ全項目（[_kNotificationsEnabled] 等9キー）を初期値に
  /// 戻す（QSET-04）。お気に入り・タイムラインのフィルタ・更新履歴の既読状態は
  /// 別画面が持つ独立した永続化キーのため対象外（誤って利用者のお気に入りを
  /// 消してしまわないよう、意図的にこの画面自身の項目のみに絞っている）。
  Future<bool> resetToDefaults() async {
    const keys = [
      _kNotificationsEnabled,
      _kNotificationLeadMinutes,
      _kAutoNotifySpecifiedGrades,
      _kNotifyFavorites,
      _kThemeMode,
      _kGoogleCalendarSyncEnabled,
      _kEnabledDisciplines,
      _kTripToleranceDays,
      _kTripLookaheadDays,
    ];
    final results = await Future.wait([
      for (final key in keys) persistWrite(() => _prefs.remove(key)),
    ]);
    state = build();
    return results.every((succeeded) => succeeded);
  }
}
