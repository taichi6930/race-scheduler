import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/di/service_locator.dart';
import '../../core/di/shared_preferences_provider.dart';
import '../../data/datasources/push_subscription_remote_data_source.dart';
import '../i_notification_scheduler.dart';
import '../data/mobile_notification_scheduler.dart';
import '../data/web_notification_scheduler.dart';

/// Web Push の VAPID公開鍵（`--dart-define=VAPID_PUBLIC_KEY=...`、W-8で配線）。
/// 未設定（空文字）の場合、Web での通知許可要求は no-op になる。
const _vapidPublicKey = String.fromEnvironment('VAPID_PUBLIC_KEY');

/// プラットフォームに応じた [INotificationScheduler] 実装を提供する。
final notificationSchedulerProvider = Provider<INotificationScheduler>((ref) {
  if (kIsWeb) {
    return WebNotificationScheduler(
      dataSource: getIt<IPushSubscriptionRemoteDataSource>(),
      vapidPublicKey: _vapidPublicKey,
      prefs: ref.watch(sharedPreferencesProvider),
    );
  }
  return MobileNotificationScheduler();
});

/// アプリ起動時に一度だけ通知基盤を初期化する。
/// `MyApp` から `ref.watch` することでライフサイクル全体を通じて保持する。
final notificationInitProvider = FutureProvider<void>((ref) {
  return ref.watch(notificationSchedulerProvider).initialize();
});

/// 通知許可の要求と購読の確立を行う（ユーザー操作起点で呼ぶこと）。
///
/// Web では [WebNotificationScheduler] の `Notification.requestPermission()`
/// を伴う購読確立を行う。モバイルでは [MobileNotificationScheduler] の
/// iOS許可要求（QNTF-11、Androidはno-op）を行う。
Future<bool> ensureWebPushEnabled(WidgetRef ref) async {
  final scheduler = ref.read(notificationSchedulerProvider);
  if (scheduler is WebNotificationScheduler) {
    return scheduler.ensureWebPushEnabled();
  }
  if (scheduler is MobileNotificationScheduler) {
    return scheduler.requestPermissions();
  }
  return true;
}

/// テスト通知を即時送信する（配信テスト機能。設定画面のボタンから呼ぶこと）。
///
/// Web以外（モバイル）は現時点でテスト送信を持たないため常に false を返す。
Future<bool> sendTestPushNotification(WidgetRef ref) async {
  final scheduler = ref.read(notificationSchedulerProvider);
  if (scheduler is WebNotificationScheduler) {
    return scheduler.sendTestNotification();
  }
  return false;
}
