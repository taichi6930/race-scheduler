import 'dart:convert';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

import 'webauthn_client.dart';

/// `package:web`（1.1.x時点）はWebAuthn Level 3のJSON変換静的メソッド
/// （`PublicKeyCredential.parseCreationOptionsFromJSON`等）をまだバインドしていないため、
/// 既存の`PublicKeyCredential`型に対して薄い追加宣言を行う。ブラウザネイティブの実装を
/// 直接呼ぶだけで、base64url⇔ArrayBufferの変換ロジックを自前実装しない。
@JS('PublicKeyCredential.parseCreationOptionsFromJSON')
external web.PublicKeyCredentialCreationOptions _parseCreationOptionsFromJSON(
  JSAny json,
);

@JS('PublicKeyCredential.parseRequestOptionsFromJSON')
external web.PublicKeyCredentialRequestOptions _parseRequestOptionsFromJSON(
  JSAny json,
);

extension on web.PublicKeyCredential {
  @JS('toJSON')
  external JSObject toJSON();
}

@JS('JSON.parse')
external JSAny _jsonParse(JSString text);

@JS('JSON.stringify')
external JSString _jsonStringify(JSAny value);

/// DartのMap（サーバーから受け取ったJSON）をJS側のオブジェクトへ変換する。
/// `JSON.stringify`→`JSON.parse`を経由することで、ネストしたオブジェクト/配列を
/// 手作業でJSAny化する必要が無い。
JSAny _toJsAny(Map<String, dynamic> map) => _jsonParse(jsonEncode(map).toJS);

/// JS側のオブジェクト（`toJSON()`の戻り値）をDartのMapへ変換する。
Map<String, dynamic> _toDartMap(JSObject jsObject) =>
    jsonDecode(_jsonStringify(jsObject).toDart) as Map<String, dynamic>;

WebauthnClient createWebauthnClient() => _BrowserWebauthnClient();

/// `package:web`（dart:js_interop）による [WebauthnClient] の実ブラウザ実装。
class _BrowserWebauthnClient implements WebauthnClient {
  @override
  Future<Map<String, dynamic>?> register(
    Map<String, dynamic> optionsJson,
  ) async {
    try {
      final publicKey = _parseCreationOptionsFromJSON(_toJsAny(optionsJson));
      final credential = await web.window.navigator.credentials
          .create(web.CredentialCreationOptions(publicKey: publicKey))
          .toDart;
      if (credential == null) return null;
      return _toDartMap((credential as web.PublicKeyCredential).toJSON());
    } catch (_) {
      // ユーザーによるキャンセル・認証器未接続等、ブラウザAPIが投げる
      // DOMException全般をここで吸収し、呼び出し元へは「失敗」として通知する。
      return null;
    }
  }

  @override
  Future<Map<String, dynamic>?> authenticate(
    Map<String, dynamic> optionsJson,
  ) async {
    try {
      final publicKey = _parseRequestOptionsFromJSON(_toJsAny(optionsJson));
      final credential = await web.window.navigator.credentials
          .get(web.CredentialRequestOptions(publicKey: publicKey))
          .toDart;
      if (credential == null) return null;
      return _toDartMap((credential as web.PublicKeyCredential).toJSON());
    } catch (_) {
      return null;
    }
  }
}
