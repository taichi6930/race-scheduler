import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/di/service_locator.dart';
import '../../core/di/shared_preferences_provider.dart';
import '../../core/network/auth_interceptor.dart';
import '../domain/auth_session.dart';

const _sessionTokenPrefsKey = 'auth_session_token';
const _sessionNicknamePrefsKey = 'auth_session_nickname';

/// 現在のログインセッション。未ログイン時はnull。
///
/// 招待受け取り→パスキー登録画面／ログイン画面から[save]で確立し、
/// APIが401を返した際（[AuthInterceptor.onUnauthorized]経由）や、
/// 将来ログアウト操作が実装された際に[clear]で破棄する。
///
/// `appRouter`（`lib/navigation/app_router.dart`）の`redirect`は、この
/// providerの値を`ref.watch`する`MyApp`（`lib/app.dart`）が
/// `authRouterState`へ反映することでログイン状態を知る。`SessionNotifier`
/// 自体は`authRouterState`を意識しない（`build()`をまるごと上書きする
/// テスト用/モック用Notifierでも一貫して反映されるようにするため、
/// 反映ポイントを1箇所＝`MyApp.build()`に集約している）。
final sessionProvider = NotifierProvider<SessionNotifier, AuthSession?>(
  SessionNotifier.new,
);

class SessionNotifier extends Notifier<AuthSession?> {
  @override
  AuthSession? build() {
    final prefs = ref.read(sharedPreferencesProvider);
    final token = prefs.getString(_sessionTokenPrefsKey);
    final nickname = prefs.getString(_sessionNicknamePrefsKey);
    final restored = (token != null && nickname != null)
        ? AuthSession(token: token, nickname: nickname)
        : null;
    _syncAuthInterceptor(token: restored?.token);
    return restored;
  }

  /// 招待登録・ログイン成功後にセッションを保存する。
  Future<void> save(AuthSession session) async {
    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.setString(_sessionTokenPrefsKey, session.token);
    await prefs.setString(_sessionNicknamePrefsKey, session.nickname);
    _syncAuthInterceptor(token: session.token);
    state = session;
  }

  /// セッションを破棄する（401受信時の自動ログアウト等）。
  Future<void> clear() async {
    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.remove(_sessionTokenPrefsKey);
    await prefs.remove(_sessionNicknamePrefsKey);
    _syncAuthInterceptor(token: null);
    state = null;
  }

  /// `AuthInterceptor`（共有Dioに登録済み）へトークン・401コールバックを配線する。
  ///
  /// `service_locator.dart`の`setupDependencies()`を呼ばない環境
  /// （モックモード・widget testの多く）では未登録のため、[GetIt.isRegistered]
  /// で存在確認してから触る。
  void _syncAuthInterceptor({required String? token}) {
    if (!getIt.isRegistered<AuthInterceptor>()) return;
    final interceptor = getIt<AuthInterceptor>();
    interceptor.token = token;
    interceptor.onUnauthorized = () => unawaited(clear());
  }
}
