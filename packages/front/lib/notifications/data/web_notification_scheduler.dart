import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/persist_write.dart';
import '../../data/datasources/push_subscription_remote_data_source.dart';
import '../../domain/entities/race_entity.dart';
import '../i_notification_scheduler.dart';
import '../notification_content.dart';
import '../notification_deep_link.dart';
import '../web_push_fire_time.dart';
import 'web_push_client/web_push_client.dart';

/// SharedPreferences に保存する購読ID/endpointのキー（PERF-119）。
@visibleForTesting
const kWebPushSubscriptionIdPrefsKey = 'web_push_subscription_id';
@visibleForTesting
const kWebPushSubscriptionEndpointPrefsKey = 'web_push_subscription_endpoint';

/// Web Push（Service Worker 登録・購読）による [INotificationScheduler] 実装
/// （web-push-design.md §7）。
///
/// サーバはお気に入り／重賞ロジックを再実装しない（Model B）ため、
/// このクラスは「予約の upsert / delete を api に送るだけ」に徹する。
/// 通知許可（`Notification.requestPermission()`）はユーザー操作起点である
/// 必要があるため、[ensureWebPushEnabled] は `ref.listen` 等の非ユーザー操作
/// コンテキストからは呼ばないこと。
///
/// 実際のブラウザ操作（Service Worker 登録・購読）は [WebPushClient] に
/// 切り出している。`package:web` は `flutter test`（VM ターゲット）では
/// 安全にコンパイルできないため、条件付き import でスタブに切り替わる
/// （`web_push_client/web_push_client.dart` 参照）。テストではこのクラスの
/// コンストラクタにフェイクの [WebPushClient] を注入できる。
class WebNotificationScheduler implements INotificationScheduler {
  WebNotificationScheduler({
    required IPushSubscriptionRemoteDataSource dataSource,
    required String vapidPublicKey,
    WebPushClient? client,
    SharedPreferences? prefs,
  }) : _dataSource = dataSource,
       _vapidPublicKey = vapidPublicKey,
       _client = client ?? createWebPushClient(),
       _prefs = prefs {
    // PERF-119: 前回起動時に確立済みの購読ID/endpointを復元する。
    // 復元できた場合、_ensureSubscribed は同じendpointである限り
    // dataSource.upsertSubscription（サーバへのPOST）を再実行しない。
    _subscriptionId = _prefs?.getString(kWebPushSubscriptionIdPrefsKey);
    _endpoint = _prefs?.getString(kWebPushSubscriptionEndpointPrefsKey);
  }

  final IPushSubscriptionRemoteDataSource _dataSource;
  final String _vapidPublicKey;
  final WebPushClient _client;
  final SharedPreferences? _prefs;

  String? _subscriptionId;
  String? _endpoint;

  /// テスト用に購読確立済みの状態を注入する
  /// （実際の Service Worker 登録・購読フローを経由せずに検証するため）。
  @visibleForTesting
  void debugSetSubscription({
    required String subscriptionId,
    required String endpoint,
  }) {
    _subscriptionId = subscriptionId;
    _endpoint = endpoint;
  }

  @override
  Future<void> initialize() async {
    if (!_client.isPermissionGranted()) return;
    await _ensureSubscribed();
  }

  /// 通知許可の要求（未許可の場合）と購読の確立をまとめて行う。
  ///
  /// ユーザー操作（設定画面の「通知を受け取る」トグル、詳細シートの
  /// 「☆ お気に入り＋通知」ボタン）から呼ぶこと。VAPID公開鍵が
  /// 未設定（dart-define未指定）の場合は何もせず false を返す。
  Future<bool> ensureWebPushEnabled() async {
    if (_vapidPublicKey.isEmpty) return false;
    if (!_client.isPermissionGranted()) {
      final granted = await _client.requestPermission();
      if (!granted) return false;
    }
    return _ensureSubscribed();
  }

  Future<bool> _ensureSubscribed() async {
    final subscription = await _client.ensureSubscribed(_vapidPublicKey);
    if (subscription == null) return false;

    // PERF-119: endpointが前回確立時（永続化 or 同一セッション内）から
    // 変わっていなければ、サーバは既にこの購読を把握しているはずなので
    // upsertSubscription（POST）を省略する。
    if (_subscriptionId != null && _endpoint == subscription.endpoint) {
      return true;
    }

    final id = await _dataSource.upsertSubscription(
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    );
    _subscriptionId = id;
    _endpoint = subscription.endpoint;
    _persistSubscription(id, subscription.endpoint);
    return true;
  }

  void _persistSubscription(String subscriptionId, String endpoint) {
    final prefs = _prefs;
    if (prefs == null) return;
    persistWrite(
      () => prefs.setString(kWebPushSubscriptionIdPrefsKey, subscriptionId),
    );
    persistWrite(
      () => prefs.setString(kWebPushSubscriptionEndpointPrefsKey, endpoint),
    );
  }

  @override
  Future<void> scheduleRaceNotification(
    RaceEntity race, {
    required int leadMinutes,
  }) async {
    final subscriptionId = _subscriptionId;
    if (!_client.isPermissionGranted() || subscriptionId == null) return;

    final fireAtMs = webPushFireAtMs(race, leadMinutes);
    if (fireAtMs <= DateTime.now().toUtc().millisecondsSinceEpoch) {
      await cancelRaceNotification(race.raceId);
      return;
    }

    final content = buildRaceNotificationContent(race, leadMinutes);
    await _dataSource.upsertRequest(
      subscriptionId: subscriptionId,
      raceId: race.raceId,
      fireAtMs: fireAtMs,
      title: content.title,
      body: content.body,
      url: notificationDeepLinkFor(race),
    );
  }

  @override
  Future<void> cancelRaceNotification(String raceId) async {
    final subscriptionId = _subscriptionId;
    if (subscriptionId == null) return;
    await _dataSource.removeRequest(
      subscriptionId: subscriptionId,
      raceId: raceId,
    );
  }

  /// 現在確立済みの購読へテスト通知を即時送信する（配信テスト機能）。
  ///
  /// 設定画面の「テスト通知を送信」ボタンから呼ぶこと。購読が未確立の場合は
  /// false を返す（呼び出し元で [ensureWebPushEnabled] を先に呼ぶ想定）。
  Future<bool> sendTestNotification() async {
    final subscriptionId = _subscriptionId;
    if (!_client.isPermissionGranted() || subscriptionId == null) {
      return false;
    }
    return _dataSource.sendTest(subscriptionId: subscriptionId);
  }

  @override
  Future<void> cancelAll() async {
    final endpoint = _endpoint;
    if (endpoint == null) return;
    // 購読自体を解除する（紐づく予約はサーバ側でカスケード削除される。
    // web-push-design.md §3「D1 の外部キー注意」参照）。
    await _dataSource.removeSubscription(endpoint: endpoint);
    _subscriptionId = null;
    _endpoint = null;
    final prefs = _prefs;
    if (prefs != null) {
      persistWrite(() => prefs.remove(kWebPushSubscriptionIdPrefsKey));
      persistWrite(() => prefs.remove(kWebPushSubscriptionEndpointPrefsKey));
    }
  }
}
