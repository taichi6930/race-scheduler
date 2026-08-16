// `flutter test`（VM ターゲット）では `package:web` が安全にコンパイルできない
// ため、`web_push_client.dart` と同様に条件付き import で切り替える：
// - Web ビルド（`dart.library.io` が存在しない）では実ブラウザ実装
// - それ以外（VM・モバイル・`flutter test`）ではスタブ実装
export 'standalone_pwa_web.dart' if (dart.library.io) 'standalone_pwa_stub.dart';
