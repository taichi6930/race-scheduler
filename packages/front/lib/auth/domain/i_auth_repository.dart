import 'auth_session.dart';

/// 登録/ログイン用のWebAuthnチャレンジ（`POST /auth/register/options`・
/// `POST /auth/login/options` のレスポンス）。
class AuthChallenge {
  const AuthChallenge({required this.challengeId, required this.options});

  /// `POST /auth/*/verify` に渡し戻すチャレンジID。
  final String challengeId;

  /// [WebauthnClient.register]/[WebauthnClient.authenticate] へそのまま渡す
  /// WebAuthnオプション（JSON）。
  final Map<String, dynamic> options;
}

/// 招待制パスキー(WebAuthn)認証基盤（`packages/api`の`/auth/*`）との通信。
abstract class IAuthRepository {
  /// 招待URLのトークンが有効か検証する。
  Future<bool> verifyInvite(String inviteToken);

  /// 登録用チャレンジを取得する。招待が無効（400）な場合はnull。
  Future<AuthChallenge?> fetchRegisterOptions(String inviteToken);

  /// 登録を完了しセッションを確立する。失敗（400）の場合はnull。
  Future<AuthSession?> verifyRegister({
    required String challengeId,
    required String nickname,
    required Map<String, dynamic> credentialResponse,
  });

  /// ログイン用チャレンジを取得する。
  Future<AuthChallenge> fetchLoginOptions();

  /// ログインを完了しセッションを確立する。失敗（401）の場合はnull。
  Future<AuthSession?> verifyLogin({
    required String challengeId,
    required Map<String, dynamic> credentialResponse,
  });
}
