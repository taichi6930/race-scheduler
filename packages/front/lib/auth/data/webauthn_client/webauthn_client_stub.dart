import 'webauthn_client.dart';

/// VM・モバイル・`flutter test` 向けのスタブ実装。
/// パスキーはWebブラウザでのみ利用可能だが、import グラフをどのターゲットでも
/// コンパイル可能に保つために用意する（web_push_client_stub.dartと同じ方針）。
WebauthnClient createWebauthnClient() => _StubWebauthnClient();

class _StubWebauthnClient implements WebauthnClient {
  @override
  Future<Map<String, dynamic>?> register(
    Map<String, dynamic> optionsJson,
  ) async => null;

  @override
  Future<Map<String, dynamic>?> authenticate(
    Map<String, dynamic> optionsJson,
  ) async => null;
}
