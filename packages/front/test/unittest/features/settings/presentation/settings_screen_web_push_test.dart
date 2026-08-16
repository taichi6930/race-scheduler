// SettingsScreen の Web Push 操作フロー（BEHAV-040/041）のデシジョンテーブル
//
// `if (kIsWeb) ...`でガードされた「テスト通知を送信」ボタン・
// `_onNotificationsEnabledChanged`のWeb分岐は、`flutter test`（VMターゲット）
// では`kIsWeb`が常にfalseになるため到達できない
// （settings_screen_test.dartのT-05参照・web-push-design.md §9）。
// `@TestOn('chrome')`により、既定のVMターゲットで実行される通常のPR用
// `flutter test`（`test-packages-front`ジョブ）ではこのファイル自体が
// スキップされる。日次スケジュール実行（scheduled-tests.ymlの
// web-push-web-platformジョブ）が`flutter test --platform chrome`で
// 明示的に実行する。
//
// | ID   | 操作                                          | 条件                                   | 期待                                                        |
// | ---- | --------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
// | T-01 | 画面表示                                      | Web環境（--platform chrome）           | 「テスト通知を送信」ボタンが表示される                       |
// | T-02 | 「テスト通知を送信」をタップ                  | 通知許可なし                           | 「通知が許可されていません」の案内ダイアログ（QNTF-08）、sendTestは呼ばれない |
// | T-03 | 「テスト通知を送信」をタップ                  | 許可済み・購読確立済み・送信成功       | 「テスト通知を送信しました」のSnackBar、dataSource.sendTestが呼ばれる |
// | T-04 | 「通知を受け取る」トグルをON                  | 許可なし・requestPermissionで許可      | ensureSubscribedが呼ばれ購読が確立される（upsertSubscription呼び出し） |
@TestOn('chrome')
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:front/core/di/shared_preferences_provider.dart';
import 'package:front/data/datasources/push_subscription_remote_data_source.dart';
import 'package:front/design/theme.dart';
import 'package:front/features/settings/presentation/settings_screen.dart';
import 'package:front/notifications/application/notification_scheduler_provider.dart';
import 'package:front/notifications/data/web_notification_scheduler.dart';
import 'package:front/notifications/data/web_push_client/web_push_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeDataSource implements IPushSubscriptionRemoteDataSource {
  int upsertSubscriptionCallCount = 0;
  final List<String> sendTestCalls = [];

  @override
  Future<String> upsertSubscription({
    required String endpoint,
    required String p256dh,
    required String auth,
  }) async {
    upsertSubscriptionCallCount++;
    return 'sub-1';
  }

  @override
  Future<void> removeSubscription({required String endpoint}) async {}

  @override
  Future<void> upsertRequest({
    required String subscriptionId,
    required String raceId,
    required int fireAtMs,
    required String title,
    required String body,
    String? url,
  }) async {}

  @override
  Future<void> removeRequest({
    required String subscriptionId,
    required String raceId,
  }) async {}

  bool sendTestResult = true;

  @override
  Future<bool> sendTest({required String subscriptionId}) async {
    sendTestCalls.add(subscriptionId);
    return sendTestResult;
  }
}

class _FakeWebPushClient implements WebPushClient {
  _FakeWebPushClient({
    this.permissionGranted = false,
    this.requestPermissionResult = true,
  });

  bool permissionGranted;
  final bool requestPermissionResult;

  @override
  bool isPermissionGranted() => permissionGranted;

  @override
  Future<bool> requestPermission() async {
    if (requestPermissionResult) permissionGranted = true;
    return requestPermissionResult;
  }

  @override
  Future<WebPushSubscription?> ensureSubscribed(String vapidPublicKey) async {
    return const WebPushSubscription(
      endpoint: 'https://push.example/ep-1',
      p256dh: 'p256dh-1',
      auth: 'auth-1',
    );
  }
}

Future<Widget> _buildApp({
  required _FakeDataSource dataSource,
  required _FakeWebPushClient client,
}) async {
  final prefs = await SharedPreferences.getInstance();
  final scheduler = WebNotificationScheduler(
    dataSource: dataSource,
    vapidPublicKey: 'test-vapid-key',
    client: client,
  );
  return ProviderScope(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      notificationSchedulerProvider.overrideWithValue(scheduler),
    ],
    child: MaterialApp(theme: AppTheme.light(), home: const SettingsScreen()),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('[T-01] Web環境ではテスト通知を送信ボタンが表示されること', (tester) async {
    await tester.pumpWidget(
      await _buildApp(
        dataSource: _FakeDataSource(),
        client: _FakeWebPushClient(),
      ),
    );
    await tester.pump();

    expect(find.text('テスト通知を送信'), findsOneWidget);
  });

  testWidgets('[T-02] テスト通知を送信タップ_通知許可なし_再許可手順の案内ダイアログが表示される', (
    tester,
  ) async {
    final dataSource = _FakeDataSource();
    final client = _FakeWebPushClient(
      permissionGranted: false,
      requestPermissionResult: false,
    );
    await tester.pumpWidget(
      await _buildApp(dataSource: dataSource, client: client),
    );
    await tester.pump();

    await tester.tap(find.text('テスト通知を送信'));
    await tester.pumpAndSettle();

    expect(find.byType(AlertDialog), findsOneWidget);
    expect(find.text('通知が許可されていません'), findsOneWidget);
    expect(dataSource.sendTestCalls, isEmpty);

    await tester.tap(find.text('閉じる'));
    await tester.pumpAndSettle();

    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets(
    '[T-03] テスト通知を送信タップ_許可済み購読確立済み送信成功_送信済みSnackBarが表示されsendTestが呼ばれる',
    (tester) async {
      final dataSource = _FakeDataSource();
      final client = _FakeWebPushClient(permissionGranted: true);
      await tester.pumpWidget(
        await _buildApp(dataSource: dataSource, client: client),
      );
      await tester.pump();

      await tester.tap(find.text('テスト通知を送信'));
      await tester.pumpAndSettle();

      expect(find.text('テスト通知を送信しました'), findsOneWidget);
      expect(dataSource.sendTestCalls, hasLength(1));
    },
  );

  testWidgets('[T-04] 通知を受け取るトグルをON_許可なしrequestPermissionで許可_購読が確立される', (
    tester,
  ) async {
    // 「通知を受け取る」の既定値はtrueのため、OFFから始めタップでONにする
    // （kIsWeb&&valueの分岐はONへの変化時のみ発火するため）。
    SharedPreferences.setMockInitialValues({
      'settings_notifications_enabled': false,
    });
    final dataSource = _FakeDataSource();
    final client = _FakeWebPushClient(
      permissionGranted: false,
      requestPermissionResult: true,
    );
    await tester.pumpWidget(
      await _buildApp(dataSource: dataSource, client: client),
    );
    await tester.pump();

    await tester.tap(find.byType(Switch).first);
    await tester.pumpAndSettle();

    expect(dataSource.upsertSubscriptionCallCount, 1);
  });
}
