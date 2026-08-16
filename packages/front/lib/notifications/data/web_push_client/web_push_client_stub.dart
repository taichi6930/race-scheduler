import 'web_push_client.dart';

/// VM・モバイル・`flutter test` 向けのスタブ実装。
/// `WebNotificationScheduler` は Web ビルド以外では使われないが、
/// import グラフをどのターゲットでもコンパイル可能に保つために用意する。
WebPushClient createWebPushClient() => _StubWebPushClient();

class _StubWebPushClient implements WebPushClient {
  @override
  bool isPermissionGranted() => false;

  @override
  Future<bool> requestPermission() async => false;

  @override
  Future<WebPushSubscription?> ensureSubscribed(String vapidPublicKey) async =>
      null;
}
