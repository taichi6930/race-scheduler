import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../core/jst_time.dart';
import '../../domain/entities/race_entity.dart';
import '../../navigation/app_router.dart';
import '../i_notification_scheduler.dart';
import '../jst_timezone.dart';
import '../notification_content.dart';
import '../notification_deep_link.dart';
import '../notification_fire_time.dart';
import '../notification_id.dart';

const _kAndroidChannelId = 'race_start_channel';
const _kAndroidChannelName = 'レース開始通知';
const _kAndroidChannelDescription = '登録レース・重賞の発走前に通知します';

/// モバイル（Android/iOS）向けのローカル通知実装（MVP、technical-design.md §5）。
///
/// `AndroidScheduleMode.inexactAllowWhileIdle` を使用する（数分程度の誤差は
/// 許容し、Android 12+ の SCHEDULE_EXACT_ALARM 権限を不要にするため）。
class MobileNotificationScheduler implements INotificationScheduler {
  MobileNotificationScheduler({FlutterLocalNotificationsPlugin? plugin})
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  bool _initialized = false;

  @override
  Future<void> initialize() async {
    if (_initialized) return;

    // IANA全タイムゾーンをロードする initializeTimeZones() の代わりに、
    // JST固定運用向けの軽量な Location を直接設定する（PERF-022）。
    tz.setLocalLocation(jstLocation);

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    // QNTF-11: 既定（引数無し）のDarwinInitializationSettingsは
    // requestAlertPermission等が全てtrueのため、initialize()（アプリ起動時）
    // の時点で即座にiOSの通知許可ダイアログが出てしまい、Web側
    // （設定トグルのタップ起点でしか許可要求しない）と非対称だった。
    // 文脈の無い許可要求は拒否されやすいため、初期化時は要求せず
    // requestPermissions()をユーザー操作起点（設定トグル・お気に入り登録）
    // から呼ぶ方式に揃える。
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
      // QNTF-10: onDidReceiveNotificationResponseを渡していなかったため、
      // Android/iOSでローカル通知をタップしても、Web側（push-sw.js）とは
      // 異なりアプリが開くだけで該当日のタイムラインへ遷移しなかった。
      // payloadにはscheduleRaceNotificationで埋め込んだ遷移先URLをそのまま
      // 使う（Web側のweb_notification_scheduler.dartと同じ`/timeline?date=`形式）。
      onDidReceiveNotificationResponse: _handleNotificationResponse,
    );
    _initialized = true;
  }

  @override
  Future<void> scheduleRaceNotification(
    RaceEntity race, {
    required int leadMinutes,
  }) async {
    final fireTime = notificationFireTime(race, leadMinutes);
    if (!isFireTimeUpcoming(fireTime, jstNow())) {
      await cancelRaceNotification(race.raceId);
      return;
    }

    final content = buildRaceNotificationContent(race, leadMinutes);
    await _plugin.zonedSchedule(
      id: notificationIdFor(race.raceId),
      title: content.title,
      body: content.body,
      scheduledDate: tz.TZDateTime.from(fireTime, tz.local),
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _kAndroidChannelId,
          _kAndroidChannelName,
          channelDescription: _kAndroidChannelDescription,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      // QNTF-10: タップ時の遷移先。Web側（web_notification_scheduler.dart）
      // と同じ`/timeline?date=...&raceId=...`形式にし、遷移処理
      // （_handleNotificationResponse）を共通化する。raceIdによりタップ時に
      // レース詳細まで自動で開ける（app_router.dartの_TimelineRouteEntry参照）。
      payload: notificationDeepLinkFor(race),
    );
  }

  @override
  Future<void> cancelRaceNotification(String raceId) {
    return _plugin.cancel(id: notificationIdFor(raceId));
  }

  @override
  Future<void> cancelAll() => _plugin.cancelAll();

  /// iOS/Androidの通知許可をユーザー操作起点で要求する（QNTF-11, QMOB-04）。
  ///
  /// 各プラットフォームの許可実装（`IOSFlutterLocalNotificationsPlugin` /
  /// `AndroidFlutterLocalNotificationsPlugin`）は、実行中のプラットフォームと
  /// 一致しない場合`resolvePlatformSpecificImplementation`がnullを返すため、
  /// 対象外プラットフォームではno-op（true固定）として扱う。
  ///
  /// QMOB-04: Android 13+ (API 33)はPOST_NOTIFICATIONS権限が無いと
  /// `zonedSchedule`自体は成功するが通知が一切表示されない（AndroidManifest.xml
  /// 側の宣言だけでは付与されず、実行時のユーザー許可が別途必要なため）。
  /// これまでAndroid側は常にtrueを返すno-opだったため、この許可要求が
  /// 一度も行われていなかった。
  Future<bool> requestPermissions() async {
    final ios = _plugin
        .resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin
        >();
    final iosGranted = ios == null
        ? true
        : await ios.requestPermissions(
                alert: true,
                badge: true,
                sound: true,
              ) ??
              false;

    final android = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    final androidGranted = android == null
        ? true
        : await android.requestNotificationsPermission() ?? false;

    return iosGranted && androidGranted;
  }
}

/// ローカル通知タップ時のコールバック（QNTF-10）。[payload] は
/// [MobileNotificationScheduler.scheduleRaceNotification] が埋め込んだ
/// 遷移先URL（`/timeline?date=...&raceId=...`、[notificationDeepLinkFor]参照）で、
/// そのまま[appRouter]へ渡す。
@visibleForTesting
void handleNotificationResponseForTesting(NotificationResponse response) =>
    _handleNotificationResponse(response);

void _handleNotificationResponse(NotificationResponse response) {
  final payload = response.payload;
  if (payload == null || payload.isEmpty) return;
  appRouter.go(payload);
}
