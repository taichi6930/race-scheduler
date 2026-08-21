// MobileNotificationScheduler のデシジョンテーブル
//
// | ID   | 条件                                                     | 期待                                        |
// | ---- | -------------------------------------------------------- | ------------------------------------------- |
// | T-01 | requestPermissions（テスト環境=iOS/Android共に解決不可、QNTF-11/QMOB-04） | true を返す（no-op） |
// | T-02 | 通知タップ・payloadあり（QNTF-10）                        | appRouterがpayloadのURLへ遷移する            |
// | T-03 | 通知タップ・payloadがnull（QNTF-10）                      | appRouterの現在地は変化しない               |
// | T-04 | 通知タップ・payloadが空文字（QNTF-10）                    | appRouterの現在地は変化しない               |
//
// QMOB-04: requestPermissions()はAndroidFlutterLocalNotificationsPluginの
// requestNotificationsPermission()も呼ぶよう拡張したが、flutter test環境
// （実機Android/iOSどちらでもない）では
// resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()も
// 従来通りnullを返すため、T-01の期待（true・no-op）は変化しない。実際に
// Android 13+でPOST_NOTIFICATIONS許可ダイアログが正しく出るかは、この
// リポジトリにAndroidインストルメンテーションテスト基盤が無いため自動化でき
// ず、実機/エミュレータでの手動確認が必要（実装時の確認事項として明記）。

import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_local_notifications_platform_interface/flutter_local_notifications_platform_interface.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/app.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/features/favorites/application/favorite_races_provider.dart';
import 'package:front/features/timeline/application/timeline_provider.dart';
import 'package:front/navigation/app_router.dart';
import 'package:front/notifications/data/mobile_notification_scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../support/session_test_overrides.dart';

/// `FlutterLocalNotificationsPlatform.instance`はlateフィールドで、
/// 実機ではプラグイン登録時に自動設定されるがflutter testでは未設定のまま
/// （`resolvePlatformSpecificImplementation`がLateInitializationErrorを
/// 投げる）。全メソッドが既定実装（UnimplementedError投げるのみ）を持つため
/// オーバーライド無しで具象化でき、テストではこれを設定するだけでよい。
class _NoopNotificationsPlatform extends FlutterLocalNotificationsPlatform {}

Future<Widget> _buildApp() async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      loggedInSessionOverride(),
      timelineProvider.overrideWith((ref, date) async => const <RaceEntity>[]),
      favoriteRacesRawProvider.overrideWith((ref) async => const <RaceEntity>[]),
    ],
    child: const MyApp(),
  );
}

void main() {
  setUpAll(() {
    FlutterLocalNotificationsPlatform.instance = _NoopNotificationsPlatform();
  });

  setUp(() {
    // GoRouter はモジュールレベルの単一インスタンスのため、
    // テスト間の状態リークを防ぐため毎回初期位置に戻す。
    appRouter.go('/timeline');
  });

  test('[T-01] requestPermissions_テスト環境iOS以外_trueを返す', () async {
    final scheduler = MobileNotificationScheduler();

    final result = await scheduler.requestPermissions();

    expect(result, isTrue);
  });

  testWidgets('[T-02] 通知タップ_payloadあり_appRouterがpayloadのURLへ遷移する', (
    tester,
  ) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();

    handleNotificationResponseForTesting(
      const NotificationResponse(
        notificationResponseType: NotificationResponseType.selectedNotification,
        payload: '/timeline?date=2026-05-01',
      ),
    );
    await tester.pumpAndSettle();

    final uri = appRouter.routerDelegate.currentConfiguration.uri;
    expect(uri.path, '/timeline');
    expect(uri.queryParameters['date'], '2026-05-01');
  });

  testWidgets('[T-03] 通知タップ_payloadがnull_appRouterの現在地は変化しない', (
    tester,
  ) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();
    final before = appRouter.routerDelegate.currentConfiguration.uri;

    handleNotificationResponseForTesting(
      const NotificationResponse(
        notificationResponseType: NotificationResponseType.selectedNotification,
      ),
    );
    await tester.pumpAndSettle();

    expect(appRouter.routerDelegate.currentConfiguration.uri, before);
  });

  testWidgets('[T-04] 通知タップ_payloadが空文字_appRouterの現在地は変化しない', (
    tester,
  ) async {
    await tester.pumpWidget(await _buildApp());
    await tester.pumpAndSettle();
    final before = appRouter.routerDelegate.currentConfiguration.uri;

    handleNotificationResponseForTesting(
      const NotificationResponse(
        notificationResponseType: NotificationResponseType.selectedNotification,
        payload: '',
      ),
    );
    await tester.pumpAndSettle();

    expect(appRouter.routerDelegate.currentConfiguration.uri, before);
  });
}
