import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:front/auth/application/session_provider.dart';
import 'package:front/auth/domain/auth_session.dart';

/// テストで「ログイン済み」を模擬する[sessionProvider]のoverride。
///
/// 全画面ログイン必須化（招待制クローズドサービス化）以降、`MyApp`
/// （`appRouter`経由）を組み立てるwidget testはこれが無いと`/login`へ
/// リダイレクトされてしまう。認証フロー自体を検証する対象でないテストでは
/// これを付与する（Rule of Three: 7ファイルで同じ固定Notifierが必要になった
/// ため共通化した）。
class _FixedSessionNotifier extends SessionNotifier {
  _FixedSessionNotifier(this._session);

  final AuthSession _session;

  @override
  AuthSession? build() => _session;
}

Override loggedInSessionOverride({String nickname = 'テストユーザー'}) {
  return sessionProvider.overrideWith(
    () => _FixedSessionNotifier(
      AuthSession(token: 'test-session-token', nickname: nickname),
    ),
  );
}
