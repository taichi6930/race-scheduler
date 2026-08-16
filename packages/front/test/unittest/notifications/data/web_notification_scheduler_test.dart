// WebNotificationScheduler のデシジョンテーブル
//
// `package:web` を直接使う購読フロー（WebPushClient の実ブラウザ実装）は
// `flutter test`（VM）では検証できないため、フェイクの WebPushClient / データ
// ソースを注入して「許可なし→no-op」「予約 upsert/delete が呼ばれる」を検証する
// （web-push-design.md §9・execution-plan.md W-7 参照）。
//
// | ID   | メソッド                | 条件                                      | 期待                                              |
// | ---- | ----------------------- | ------------------------------------------ | -------------------------------------------------- |
// | T-01 | initialize              | 許可なし                                   | ensureSubscribedが呼ばれない（no-op）              |
// | T-02 | ensureWebPushEnabled    | VAPID公開鍵が空文字                        | falseを返し、requestPermission/ensureSubscribedが呼ばれない |
// | T-03 | ensureWebPushEnabled    | 許可なし・requestPermissionが拒否           | falseを返し、ensureSubscribedが呼ばれない          |
// | T-04 | ensureWebPushEnabled    | 許可なし・requestPermissionが許可・購読成功 | trueを返しdataSource.upsertSubscriptionが呼ばれる  |
// | T-05 | scheduleRaceNotification| 購読未確立                                 | dataSource.upsertRequestが呼ばれない（no-op）      |
// | T-06 | scheduleRaceNotification| 購読確立済み・発火時刻が未来                | dataSource.upsertRequestが呼ばれ、通知タップ時の遷移先urlも渡される（NAV-04） |
// | T-07 | scheduleRaceNotification| 購読確立済み・発火時刻が過去                | upsertRequestではなくremoveRequestが呼ばれる       |
// | T-08 | cancelRaceNotification  | 購読未確立                                 | dataSource.removeRequestが呼ばれない（no-op）      |
// | T-09 | cancelRaceNotification  | 購読確立済み                               | dataSource.removeRequestが呼ばれる                 |
// | T-10 | cancelAll               | 購読未確立                                 | dataSource.removeSubscriptionが呼ばれない（no-op） |
// | T-11 | cancelAll               | 購読確立済み                               | dataSource.removeSubscriptionが呼ばれ内部状態がリセットされる |
// | T-12 | sendTestNotification    | 購読未確立                                 | falseを返しdataSource.sendTestが呼ばれない（no-op） |
// | T-13 | sendTestNotification    | 購読確立済み・送信成功                     | trueを返しdataSource.sendTestが呼ばれる            |
// | T-14 | sendTestNotification    | 購読確立済み・送信失敗                     | falseを返す                                        |
// | T-15 | ensureWebPushEnabled    | prefsに永続化済みの購読ID/endpointがあり、実際のendpointと一致 | upsertSubscriptionが呼ばれず、永続化済みのsubscriptionIdが使われること（PERF-119） |
// | T-16 | ensureWebPushEnabled    | prefsに永続化済みの購読があるが実際のendpointが異なる | upsertSubscriptionが呼ばれ、prefsが新しいID/endpointで上書きされること |
// | T-17 | ensureWebPushEnabled    | prefs指定・新規購読成功                    | prefsにsubscriptionId/endpointが永続化されること   |
// | T-18 | cancelAll               | prefs指定・購読確立済み                    | prefsからsubscriptionId/endpointが削除されること   |

import 'package:flutter_test/flutter_test.dart';
import 'package:front/data/datasources/push_subscription_remote_data_source.dart';
import 'package:front/domain/entities/race_entity.dart';
import 'package:front/notifications/data/web_notification_scheduler.dart';
import 'package:front/notifications/data/web_push_client/web_push_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeDataSource implements IPushSubscriptionRemoteDataSource {
  _FakeDataSource({
    this.upsertSubscriptionResult = 'sub-1',
    this.sendTestResult = true,
  });

  final String upsertSubscriptionResult;
  final bool sendTestResult;
  int upsertSubscriptionCallCount = 0;
  int removeSubscriptionCallCount = 0;
  String? lastRemovedEndpoint;
  final List<Map<String, Object?>> upsertRequestCalls = [];
  final List<Map<String, String>> removeRequestCalls = [];
  final List<String> sendTestCalls = [];

  @override
  Future<String> upsertSubscription({
    required String endpoint,
    required String p256dh,
    required String auth,
  }) async {
    upsertSubscriptionCallCount++;
    return upsertSubscriptionResult;
  }

  @override
  Future<void> removeSubscription({required String endpoint}) async {
    removeSubscriptionCallCount++;
    lastRemovedEndpoint = endpoint;
  }

  @override
  Future<void> upsertRequest({
    required String subscriptionId,
    required String raceId,
    required int fireAtMs,
    required String title,
    required String body,
    String? url,
  }) async {
    upsertRequestCalls.add({
      'subscriptionId': subscriptionId,
      'raceId': raceId,
      'fireAtMs': fireAtMs,
      'title': title,
      'body': body,
      'url': url,
    });
  }

  @override
  Future<void> removeRequest({
    required String subscriptionId,
    required String raceId,
  }) async {
    removeRequestCalls.add({
      'subscriptionId': subscriptionId,
      'raceId': raceId,
    });
  }

  @override
  Future<bool> sendTest({required String subscriptionId}) async {
    sendTestCalls.add(subscriptionId);
    return sendTestResult;
  }
}

class _FakeWebPushClient implements WebPushClient {
  _FakeWebPushClient({
    this.permissionGranted = false,
    this.requestPermissionResult = false,
    this.subscription,
  });

  bool permissionGranted;
  final bool requestPermissionResult;
  final WebPushSubscription? subscription;
  int ensureSubscribedCallCount = 0;
  int requestPermissionCallCount = 0;

  @override
  bool isPermissionGranted() => permissionGranted;

  @override
  Future<bool> requestPermission() async {
    requestPermissionCallCount++;
    if (requestPermissionResult) permissionGranted = true;
    return requestPermissionResult;
  }

  @override
  Future<WebPushSubscription?> ensureSubscribed(String vapidPublicKey) async {
    ensureSubscribedCallCount++;
    return subscription;
  }
}

RaceEntity _race({String datetime = '2100-01-01T15:40:00'}) => RaceEntity(
  raceId: 'race-001',
  raceName: 'テストレース',
  raceType: 'jra',
  placeId: 'place-001',
  raceCourse: '中山',
  datetime: datetime,
  raceNumber: 11,
);

void main() {
  group('initialize', () {
    test('[T-01] 許可なしの場合はensureSubscribedが呼ばれないこと', () async {
      final client = _FakeWebPushClient(permissionGranted: false);
      final scheduler = WebNotificationScheduler(
        dataSource: _FakeDataSource(),
        vapidPublicKey: 'vapid-key',
        client: client,
      );

      await scheduler.initialize();

      expect(client.ensureSubscribedCallCount, 0);
    });
  });

  group('ensureWebPushEnabled', () {
    test('[T-02] VAPID公開鍵が空文字の場合はfalseを返し何もしないこと', () async {
      final client = _FakeWebPushClient(permissionGranted: false);
      final scheduler = WebNotificationScheduler(
        dataSource: _FakeDataSource(),
        vapidPublicKey: '',
        client: client,
      );

      final result = await scheduler.ensureWebPushEnabled();

      expect(result, isFalse);
      expect(client.requestPermissionCallCount, 0);
      expect(client.ensureSubscribedCallCount, 0);
    });

    test('[T-03] 許可要求が拒否された場合はfalseを返しensureSubscribedが呼ばれないこと', () async {
      final client = _FakeWebPushClient(
        permissionGranted: false,
        requestPermissionResult: false,
      );
      final scheduler = WebNotificationScheduler(
        dataSource: _FakeDataSource(),
        vapidPublicKey: 'vapid-key',
        client: client,
      );

      final result = await scheduler.ensureWebPushEnabled();

      expect(result, isFalse);
      expect(client.requestPermissionCallCount, 1);
      expect(client.ensureSubscribedCallCount, 0);
    });

    test('[T-04] 許可され購読に成功した場合はtrueを返しupsertSubscriptionが呼ばれること', () async {
      final dataSource = _FakeDataSource(upsertSubscriptionResult: 'sub-42');
      final client = _FakeWebPushClient(
        permissionGranted: false,
        requestPermissionResult: true,
        subscription: const WebPushSubscription(
          endpoint: 'https://push.example.com/1',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        ),
      );
      final scheduler = WebNotificationScheduler(
        dataSource: dataSource,
        vapidPublicKey: 'vapid-key',
        client: client,
      );

      final result = await scheduler.ensureWebPushEnabled();

      expect(result, isTrue);
      expect(dataSource.upsertSubscriptionCallCount, 1);
    });
  });

  group('scheduleRaceNotification', () {
    test('[T-05] 購読未確立の場合はupsertRequestが呼ばれないこと', () async {
      final dataSource = _FakeDataSource();
      final scheduler = WebNotificationScheduler(
        dataSource: dataSource,
        vapidPublicKey: 'vapid-key',
        client: _FakeWebPushClient(permissionGranted: true),
      );

      await scheduler.scheduleRaceNotification(_race(), leadMinutes: 5);

      expect(dataSource.upsertRequestCalls, isEmpty);
    });

    test('[T-06] 購読確立済み・発火時刻が未来の場合はupsertRequestが呼ばれること', () async {
      final dataSource = _FakeDataSource();
      final scheduler =
          WebNotificationScheduler(
            dataSource: dataSource,
            vapidPublicKey: 'vapid-key',
            client: _FakeWebPushClient(permissionGranted: true),
          )..debugSetSubscription(
            subscriptionId: 'sub-1',
            endpoint: 'https://push.example.com/1',
          );

      await scheduler.scheduleRaceNotification(
        _race(datetime: '2100-01-01T15:40:00'),
        leadMinutes: 5,
      );

      expect(dataSource.upsertRequestCalls, hasLength(1));
      expect(dataSource.upsertRequestCalls.single['subscriptionId'], 'sub-1');
      expect(dataSource.upsertRequestCalls.single['raceId'], 'race-001');
      expect(
        dataSource.upsertRequestCalls.single['url'],
        '/timeline?date=2100-01-01&raceId=race-001',
      );
      expect(dataSource.removeRequestCalls, isEmpty);
    });

    test('[T-07] 購読確立済み・発火時刻が過去の場合はremoveRequestが呼ばれること', () async {
      final dataSource = _FakeDataSource();
      final scheduler =
          WebNotificationScheduler(
            dataSource: dataSource,
            vapidPublicKey: 'vapid-key',
            client: _FakeWebPushClient(permissionGranted: true),
          )..debugSetSubscription(
            subscriptionId: 'sub-1',
            endpoint: 'https://push.example.com/1',
          );

      await scheduler.scheduleRaceNotification(
        _race(datetime: '2000-01-01T15:40:00'),
        leadMinutes: 5,
      );

      expect(dataSource.upsertRequestCalls, isEmpty);
      expect(dataSource.removeRequestCalls, hasLength(1));
      expect(dataSource.removeRequestCalls.single['raceId'], 'race-001');
    });
  });

  group('cancelRaceNotification', () {
    test('[T-08] 購読未確立の場合はremoveRequestが呼ばれないこと', () async {
      final dataSource = _FakeDataSource();
      final scheduler = WebNotificationScheduler(
        dataSource: dataSource,
        vapidPublicKey: 'vapid-key',
        client: _FakeWebPushClient(),
      );

      await scheduler.cancelRaceNotification('race-001');

      expect(dataSource.removeRequestCalls, isEmpty);
    });

    test('[T-09] 購読確立済みの場合はremoveRequestが呼ばれること', () async {
      final dataSource = _FakeDataSource();
      final scheduler =
          WebNotificationScheduler(
            dataSource: dataSource,
            vapidPublicKey: 'vapid-key',
            client: _FakeWebPushClient(),
          )..debugSetSubscription(
            subscriptionId: 'sub-1',
            endpoint: 'https://push.example.com/1',
          );

      await scheduler.cancelRaceNotification('race-001');

      expect(dataSource.removeRequestCalls, hasLength(1));
      expect(dataSource.removeRequestCalls.single, {
        'subscriptionId': 'sub-1',
        'raceId': 'race-001',
      });
    });
  });

  group('cancelAll', () {
    test('[T-10] 購読未確立の場合はremoveSubscriptionが呼ばれないこと', () async {
      final dataSource = _FakeDataSource();
      final scheduler = WebNotificationScheduler(
        dataSource: dataSource,
        vapidPublicKey: 'vapid-key',
        client: _FakeWebPushClient(),
      );

      await scheduler.cancelAll();

      expect(dataSource.removeSubscriptionCallCount, 0);
    });

    test('[T-11] 購読確立済みの場合はremoveSubscriptionが呼ばれ内部状態がリセットされること', () async {
      final dataSource = _FakeDataSource();
      final scheduler =
          WebNotificationScheduler(
            dataSource: dataSource,
            vapidPublicKey: 'vapid-key',
            client: _FakeWebPushClient(permissionGranted: true),
          )..debugSetSubscription(
            subscriptionId: 'sub-1',
            endpoint: 'https://push.example.com/1',
          );

      await scheduler.cancelAll();

      expect(dataSource.removeSubscriptionCallCount, 1);
      expect(dataSource.lastRemovedEndpoint, 'https://push.example.com/1');

      // 内部状態がリセットされているため、以後の予約系呼び出しはno-opになる。
      await scheduler.scheduleRaceNotification(_race(), leadMinutes: 5);
      expect(dataSource.upsertRequestCalls, isEmpty);
    });
  });

  group('sendTestNotification', () {
    test('[T-12] 購読未確立の場合はfalseを返しsendTestが呼ばれないこと', () async {
      final dataSource = _FakeDataSource();
      final scheduler = WebNotificationScheduler(
        dataSource: dataSource,
        vapidPublicKey: 'vapid-key',
        client: _FakeWebPushClient(permissionGranted: true),
      );

      final result = await scheduler.sendTestNotification();

      expect(result, isFalse);
      expect(dataSource.sendTestCalls, isEmpty);
    });

    test('[T-13] 購読確立済み・送信成功の場合はtrueを返しsendTestが呼ばれること', () async {
      final dataSource = _FakeDataSource(sendTestResult: true);
      final scheduler =
          WebNotificationScheduler(
            dataSource: dataSource,
            vapidPublicKey: 'vapid-key',
            client: _FakeWebPushClient(permissionGranted: true),
          )..debugSetSubscription(
            subscriptionId: 'sub-1',
            endpoint: 'https://push.example.com/1',
          );

      final result = await scheduler.sendTestNotification();

      expect(result, isTrue);
      expect(dataSource.sendTestCalls, ['sub-1']);
    });

    test('[T-14] 購読確立済み・送信失敗の場合はfalseを返すこと', () async {
      final dataSource = _FakeDataSource(sendTestResult: false);
      final scheduler =
          WebNotificationScheduler(
            dataSource: dataSource,
            vapidPublicKey: 'vapid-key',
            client: _FakeWebPushClient(permissionGranted: true),
          )..debugSetSubscription(
            subscriptionId: 'sub-1',
            endpoint: 'https://push.example.com/1',
          );

      final result = await scheduler.sendTestNotification();

      expect(result, isFalse);
    });
  });

  group('永続化（PERF-119）', () {
    test(
      '[T-15] 永続化済みのendpointと実際のendpointが一致する場合はupsertSubscriptionが呼ばれないこと',
      () async {
        SharedPreferences.setMockInitialValues({
          kWebPushSubscriptionIdPrefsKey: 'sub-persisted',
          kWebPushSubscriptionEndpointPrefsKey: 'https://push.example.com/1',
        });
        final prefs = await SharedPreferences.getInstance();
        final dataSource = _FakeDataSource();
        final client = _FakeWebPushClient(
          permissionGranted: false,
          requestPermissionResult: true,
          subscription: const WebPushSubscription(
            endpoint: 'https://push.example.com/1',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
          ),
        );
        final scheduler = WebNotificationScheduler(
          dataSource: dataSource,
          vapidPublicKey: 'vapid-key',
          client: client,
          prefs: prefs,
        );

        final result = await scheduler.ensureWebPushEnabled();

        expect(result, isTrue);
        expect(dataSource.upsertSubscriptionCallCount, 0);
        expect(dataSource.upsertRequestCalls, isEmpty);
      },
    );

    test(
      '[T-16] 永続化済みのendpointと実際のendpointが異なる場合はupsertSubscriptionが呼ばれprefsが上書きされること',
      () async {
        SharedPreferences.setMockInitialValues({
          kWebPushSubscriptionIdPrefsKey: 'sub-old',
          kWebPushSubscriptionEndpointPrefsKey: 'https://push.example.com/old',
        });
        final prefs = await SharedPreferences.getInstance();
        final dataSource = _FakeDataSource(upsertSubscriptionResult: 'sub-new');
        final client = _FakeWebPushClient(
          permissionGranted: false,
          requestPermissionResult: true,
          subscription: const WebPushSubscription(
            endpoint: 'https://push.example.com/new',
            p256dh: 'p256dh-value',
            auth: 'auth-value',
          ),
        );
        final scheduler = WebNotificationScheduler(
          dataSource: dataSource,
          vapidPublicKey: 'vapid-key',
          client: client,
          prefs: prefs,
        );

        final result = await scheduler.ensureWebPushEnabled();

        expect(result, isTrue);
        expect(dataSource.upsertSubscriptionCallCount, 1);
        expect(prefs.getString(kWebPushSubscriptionIdPrefsKey), 'sub-new');
        expect(
          prefs.getString(kWebPushSubscriptionEndpointPrefsKey),
          'https://push.example.com/new',
        );
      },
    );

    test('[T-17] 新規購読成功時にprefsへsubscriptionId/endpointが永続化されること', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final dataSource = _FakeDataSource(upsertSubscriptionResult: 'sub-42');
      final client = _FakeWebPushClient(
        permissionGranted: false,
        requestPermissionResult: true,
        subscription: const WebPushSubscription(
          endpoint: 'https://push.example.com/1',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        ),
      );
      final scheduler = WebNotificationScheduler(
        dataSource: dataSource,
        vapidPublicKey: 'vapid-key',
        client: client,
        prefs: prefs,
      );

      await scheduler.ensureWebPushEnabled();

      expect(prefs.getString(kWebPushSubscriptionIdPrefsKey), 'sub-42');
      expect(
        prefs.getString(kWebPushSubscriptionEndpointPrefsKey),
        'https://push.example.com/1',
      );
    });

    test('[T-18] cancelAll時にprefsからsubscriptionId/endpointが削除されること', () async {
      SharedPreferences.setMockInitialValues({
        kWebPushSubscriptionIdPrefsKey: 'sub-1',
        kWebPushSubscriptionEndpointPrefsKey: 'https://push.example.com/1',
      });
      final prefs = await SharedPreferences.getInstance();
      final dataSource = _FakeDataSource();
      final scheduler =
          WebNotificationScheduler(
            dataSource: dataSource,
            vapidPublicKey: 'vapid-key',
            client: _FakeWebPushClient(),
            prefs: prefs,
          )..debugSetSubscription(
            subscriptionId: 'sub-1',
            endpoint: 'https://push.example.com/1',
          );

      await scheduler.cancelAll();

      expect(prefs.getString(kWebPushSubscriptionIdPrefsKey), isNull);
      expect(prefs.getString(kWebPushSubscriptionEndpointPrefsKey), isNull);
    });
  });
}
