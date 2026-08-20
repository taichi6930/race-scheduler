/// ログイン中のセッション（トークン・ニックネーム）。
///
/// `POST /auth/register/verify`・`POST /auth/login/verify` のレスポンス
/// （`{sessionToken, nickname}`）をそのまま表す最小限の値オブジェクト。
class AuthSession {
  const AuthSession({required this.token, required this.nickname});

  /// `Authorization: Bearer <token>` として全APIリクエストへ付与するトークン。
  final String token;

  /// 登録時に入力したニックネーム。
  final String nickname;
}
