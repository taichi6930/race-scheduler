// `flutter test`（VMターゲット）で安全にコンパイルするため、web_push_client.dart と
// 同じ条件付きexportパターンを踏襲する（package:webはWebビルドでのみ参照可能）。
export 'webauthn_client_web.dart'
    if (dart.library.io) 'webauthn_client_stub.dart';

/// パスキー(WebAuthn)のブラウザAPI（`navigator.credentials`）を呼ぶクライアント。
/// `createWebauthnClient()`（条件付きexportされる各実装ファイルが提供）で取得する。
///
/// サーバー（`@simplewebauthn/server`）とはJSON形式（challenge等がbase64url文字列）で
/// やり取りし、ブラウザAPIとはバイナリ（ArrayBuffer）でやり取りする必要があるが、
/// この変換はブラウザがネイティブに持つ `PublicKeyCredential.parseCreationOptionsFromJSON`/
/// `parseRequestOptionsFromJSON`/`toJSON()`（WebAuthn Level 3）に委譲し、base64url⇔
/// ArrayBufferの変換をアプリ側で手書きしない（Chrome116+/Safari16.4+/Edge116+で対応済み、
/// 2026年時点で対象ブラウザは全て対応している）。
abstract class WebauthnClient {
  /// `POST /auth/register/options` が返した `options`（JSON、Map形式）を渡し、
  /// パスキー登録を行う。ユーザーがキャンセルした場合等はnullを返す（例外を投げない）。
  Future<Map<String, dynamic>?> register(Map<String, dynamic> optionsJson);

  /// `POST /auth/login/options` が返した `options`（JSON、Map形式）を渡し、
  /// パスキーでログインする。ユーザーがキャンセルした場合等はnullを返す（例外を投げない）。
  Future<Map<String, dynamic>?> authenticate(Map<String, dynamic> optionsJson);
}
