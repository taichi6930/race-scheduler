// `flutter test`（VM ターゲット）では `package:web` が安全にコンパイルできない
// （`dio_web_adapter` 等が参照する内部ヘルパが web/wasm コンパイルターゲット
// 前提のため）。そのため実装は条件付き import で切り替える：
// - Web ビルド（`dart.library.io` が存在しない）では実ブラウザ実装
// - それ以外（VM・モバイル・`flutter test`）ではスタブ実装
//
// このファイル自体は package:web を一切参照しないため、どのターゲットからでも
// 安全に import できる。
export 'web_push_client_web.dart'
    if (dart.library.io) 'web_push_client_stub.dart';

/// 購読の確立結果（Push Service エンドポイント・暗号鍵）。
class WebPushSubscription {
  const WebPushSubscription({
    required this.endpoint,
    required this.p256dh,
    required this.auth,
  });

  final String endpoint;
  final String p256dh;
  final String auth;
}

/// ブラウザの Service Worker / Push API / Notification 権限を扱うクライアント。
/// `createWebPushClient()`（条件付き export される各実装ファイルが提供）で取得する。
abstract class WebPushClient {
  /// 通知許可が既に得られているかどうか。
  bool isPermissionGranted();

  /// 通知許可を要求する（ユーザー操作起点で呼ぶこと）。許可された場合 true。
  Future<bool> requestPermission();

  /// Service Worker を登録し、Push Service への購読を確立する。
  /// 失敗した場合は null を返す（例外を投げない）。
  Future<WebPushSubscription?> ensureSubscribed(String vapidPublicKey);
}
