import 'dart:convert';
import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import 'web_push_client.dart';

/// Web Push 用 Service Worker のスクリプトURL・スコープ（web/push-sw.js, web/index.html と対応）。
///
/// SEC-062: `web/index.html` の `navigator.serviceWorker.register(...)` 呼び出しで
/// 同じ値が重複定義されている（静的HTMLとDartコードという別々のビルド成果物にまたがるため
/// ビルド時の自動注入は無く手動同期）。値を変更する場合は両方を直すこと。
const _pushServiceWorkerScriptUrl = 'push-sw.js';
const _pushServiceWorkerScope = '/push/';

/// Base64URL（パディング無し）文字列をバイト列に変換する。
Uint8List _decodeBase64Url(String value) {
  return base64Url.decode(base64Url.normalize(value));
}

/// バイト列を Base64URL（パディング無し）文字列に変換する。
String _encodeBase64Url(Uint8List bytes) {
  return base64Url.encode(bytes).replaceAll('=', '');
}

WebPushClient createWebPushClient() => _BrowserWebPushClient();

/// `package:web`（dart:js_interop）による [WebPushClient] の実ブラウザ実装。
class _BrowserWebPushClient implements WebPushClient {
  @override
  bool isPermissionGranted() => web.Notification.permission == 'granted';

  @override
  Future<bool> requestPermission() async {
    final permission = await web.Notification.requestPermission().toDart;
    return permission.toDart == 'granted';
  }

  @override
  Future<WebPushSubscription?> ensureSubscribed(String vapidPublicKey) async {
    try {
      final registration = await web.window.navigator.serviceWorker
          .register(
            _pushServiceWorkerScriptUrl.toJS,
            web.RegistrationOptions(scope: _pushServiceWorkerScope),
          )
          .toDart;
      // PERF-120: 既存購読があればそれを再利用し、ブラウザによっては毎回
      // 発生しうるサブスクリプション交渉（subscribe()の再呼び出し）を避ける。
      // 既存購読が無い場合のみ subscribe() で新規購読する。
      final subscription =
          await registration.pushManager.getSubscription().toDart ??
          await registration.pushManager
              .subscribe(
                web.PushSubscriptionOptionsInit(
                  userVisibleOnly: true,
                  applicationServerKey: _decodeBase64Url(vapidPublicKey).toJS,
                ),
              )
              .toDart;
      final p256dhBuffer = subscription.getKey('p256dh');
      final authBuffer = subscription.getKey('auth');
      if (p256dhBuffer == null || authBuffer == null) return null;

      return WebPushSubscription(
        endpoint: subscription.endpoint,
        p256dh: _encodeBase64Url(p256dhBuffer.toDart.asUint8List()),
        auth: _encodeBase64Url(authBuffer.toDart.asUint8List()),
      );
    } catch (_) {
      return null;
    }
  }
}
